import { db } from "@/lib/db";
import { NotificationService } from "@/lib/notifications";

export async function notifyKpiResult(resultId: string) {
  const result = await db.kpiResult.findUnique({
    where: { id: resultId },
    include: {
      staff: { select: { id: true, name: true, email: true, role: { select: { name: true } } } },
      kpiTarget: true,
    },
  });

  if (!result) return;

  await NotificationService.createNotification({
    userId: result.staffId,
    type: "KPI_RESULTS_AVAILABLE",
    message: `Your KPI results for ${result.periodLabel} are available. Achievement: ${result.achievementPercentage.toFixed(2)}%.`,
    linkUrl: result.kpiTarget.organisationType === "EDUQUANTICA" ? "/dashboard/kpi" : "/agent/kpi",
  }).catch(() => undefined);

  if (result.achievementPercentage < 70) {
    if (result.kpiTarget.organisationType === "EDUQUANTICA") {
      const recipients = await db.user.findMany({
        where: { role: { name: { in: ["ADMIN", "MANAGER"] } }, isActive: true },
        select: { id: true },
      });

      for (const recipient of recipients) {
        await NotificationService.createNotification({
          userId: recipient.id,
          type: "KPI_BELOW_TARGET",
          message: `${result.staff.name || result.staff.email} is below KPI target for ${result.periodLabel}. Current achievement: ${result.achievementPercentage.toFixed(2)}%.`,
          linkUrl: "/dashboard/kpi",
          actorUserId: result.staffId,
        }).catch(() => undefined);
      }
    } else if (result.kpiTarget.organisationType.startsWith("SUBAGENT_")) {
      const subAgentId = result.kpiTarget.organisationType.replace("SUBAGENT_", "");
      const [owner, managerStaff] = await Promise.all([
        db.subAgent.findUnique({ where: { id: subAgentId }, select: { userId: true } }),
        db.subAgentStaff.findMany({ where: { subAgentId, role: { contains: "MANAGER" }, isActive: true }, select: { userId: true } }),
      ]);

      const recipientIds = new Set<string>();
      if (owner?.userId) recipientIds.add(owner.userId);
      managerStaff.forEach((row) => recipientIds.add(row.userId));

      for (const id of Array.from(recipientIds)) {
        await NotificationService.createNotification({
          userId: id,
          type: "KPI_BELOW_TARGET",
          message: `${result.staff.name || result.staff.email} is below KPI target for ${result.periodLabel}. Current achievement: ${result.achievementPercentage.toFixed(2)}%.`,
          linkUrl: "/agent/kpi",
          actorUserId: result.staffId,
        }).catch(() => undefined);
      }
    }
  }
}

export async function notifyMonthlyTeamSummary(referenceDate = new Date()) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);

  const monthly = await db.kpiResult.findMany({
    where: {
      kpiTarget: { organisationType: "EDUQUANTICA" },
      startDate: { gte: start },
      endDate: { lte: end },
    },
    include: { staff: { select: { name: true, email: true } } },
  });

  if (!monthly.length) return;

  const avg = monthly.reduce((sum, row) => sum + row.achievementPercentage, 0) / monthly.length;
  const top = [...monthly].sort((a, b) => b.achievementPercentage - a.achievementPercentage)[0];
  const lowNames = monthly
    .filter((row) => row.achievementPercentage < 70)
    .map((row) => row.staff.name || row.staff.email)
    .slice(0, 4)
    .join(", ") || "None";

  const admins = await db.user.findMany({ where: { role: { name: "ADMIN" }, isActive: true }, select: { id: true } });

  for (const admin of admins) {
    await NotificationService.createNotification({
      userId: admin.id,
      type: "KPI_TEAM_MONTHLY_SUMMARY",
      message: `Team KPI summary for ${start.toLocaleString("en-GB", { month: "long", year: "numeric" })}: Average achievement ${avg.toFixed(2)}%. Top performer: ${top.staff.name || top.staff.email}. Needs attention: ${lowNames}.`,
      linkUrl: "/dashboard/kpi",
    }).catch(() => undefined);
  }
}
