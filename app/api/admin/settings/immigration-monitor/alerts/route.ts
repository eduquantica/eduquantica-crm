import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCurrentFinancialSettingForCountry } from "@/lib/immigration-monitor";

function canRead(session: unknown) {
  const roleName = (session as { user?: { roleName?: string } } | null)?.user?.roleName;
  return roleName === "ADMIN" || roleName === "MANAGER";
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!canRead(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const alerts = await db.immigrationRuleAlert.findMany({
    orderBy: { detectedAt: "desc" },
    include: {
      changelog: {
        select: {
          id: true,
          summary: true,
          createdAt: true,
          confirmedByUser: {
            select: { id: true, name: true, email: true },
          },
        },
      },
      confirmedByUser: {
        select: { id: true, name: true, email: true },
      },
    },
    take: 150,
  });

  const data = await Promise.all(
    alerts.map(async (alert) => {
      const current = await getCurrentFinancialSettingForCountry(alert.country);
      const settingsUpdatedSinceDetection = await db.activityLog.findFirst({
        where: {
          entityType: "financialRequirementSettings",
          entityId: alert.country,
          action: "upsert",
          createdAt: { gte: alert.detectedAt },
        },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });

      return {
        id: alert.id,
        country: alert.country,
        pageUrl: alert.pageUrl,
        oldContent: alert.oldContent,
        newContent: alert.newContent,
        diffSummary: alert.diffSummary,
        detectedAt: alert.detectedAt,
        status: alert.status,
        oldMonthlyLivingCost: alert.oldMonthlyLivingCost,
        detectedMonthlyLivingCost: alert.newMonthlyLivingCost,
        currency: alert.currency || current.currency,
        currentSettingMonthlyLivingCost: current.monthlyLivingCost,
        currentSettingCurrency: current.currency,
        settingsUpdatedAt: settingsUpdatedSinceDetection?.createdAt || null,
        canConfirmPublish: Boolean(settingsUpdatedSinceDetection),
        confirmedAt: alert.confirmedAt,
        confirmedByUser: alert.confirmedByUser,
        changelog: alert.changelog,
      };
    }),
  );

  return NextResponse.json({ data });
}
