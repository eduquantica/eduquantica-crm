import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

function staffGuard(session: Session | null) {
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const r = session.user.roleName;
  if (r === "STUDENT" || r === "SUB_AGENT")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

function pctChange(current: number, prev: number): number | null {
  if (prev === 0) return null;
  return Math.round(((current - prev) / prev) * 100);
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const guard = staffGuard(session);
  if (guard) return guard;

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  // ── COUNSELLOR: return stats scoped to their own data only ──────────────────
  if (session!.user.roleName === "COUNSELLOR") {
    const uid = session!.user.id;
    const [leadsThis, leadsLast, activeApps, appsCreatedThis, appsCreatedLast, enrolledTotal] =
      await Promise.all([
        db.lead.count({ where: { assignedCounsellorId: uid, createdAt: { gte: thisMonthStart } } }),
        db.lead.count({ where: { assignedCounsellorId: uid, createdAt: { gte: lastMonthStart, lt: thisMonthStart } } }),
        db.application.count({ where: { counsellorId: uid, status: { notIn: ["ENROLLED", "WITHDRAWN"] } } }),
        db.application.count({ where: { counsellorId: uid, createdAt: { gte: thisMonthStart } } }),
        db.application.count({ where: { counsellorId: uid, createdAt: { gte: lastMonthStart, lt: thisMonthStart } } }),
        db.application.count({ where: { counsellorId: uid, status: "ENROLLED" } }),
      ]);

    const [totalStudents, totalApplications] = await Promise.all([
      db.student.count({ where: { assignedCounsellorId: uid } }),
      db.application.count({ where: { counsellorId: uid } }),
    ]);

    const avgApplicationsPerStudent = totalStudents > 0
      ? Math.round((totalApplications / totalStudents) * 100) / 100
      : 0;

    return NextResponse.json({
      data: {
        leadsThisMonth: { value: leadsThis, change: pctChange(leadsThis, leadsLast) },
        activeApplications: { value: activeApps, change: pctChange(appsCreatedThis, appsCreatedLast) },
        enrolledStudents: { value: enrolledTotal, change: null },
        revenueThisMonth: null,
        activeSubAgents: null,
        pendingSubAgents: null,
        totalStudents: { value: totalStudents, change: null },
        totalApplications: { value: totalApplications, change: null },
        avgApplicationsPerStudent: { value: avgApplicationsPerStudent, change: null },
      },
    });
  }

  const [
    leadsThis,
    leadsLast,
    activeApps,
    appsCreatedThis,
    appsCreatedLast,
    enrolledTotal,
    revenueThis,
    revenueLast,
    activeSubAgents,
    newApprovedThis,
    newApprovedLast,
    pendingSubAgents,
    pendingCreatedThis,
    pendingCreatedLast,
    totalStudents,
    totalApplications,
  ] = await Promise.all([
    // Leads this month
    db.lead.count({ where: { createdAt: { gte: thisMonthStart } } }),
    // Leads last month
    db.lead.count({ where: { createdAt: { gte: lastMonthStart, lt: thisMonthStart } } }),

    // Active applications (snapshot: exclude terminal states)
    db.application.count({ where: { status: { notIn: ["ENROLLED", "WITHDRAWN"] } } }),
    // New applications created this month (for trend)
    db.application.count({ where: { createdAt: { gte: thisMonthStart } } }),
    // New applications created last month
    db.application.count({ where: { createdAt: { gte: lastMonthStart, lt: thisMonthStart } } }),

    // Total enrolled
    db.application.count({ where: { status: "ENROLLED" } }),

    // Revenue this month (PAID commissions by enrolmentConfirmedAt)
    db.commission.aggregate({
      _sum: { eduquanticaNet: true },
      where: { status: "PAID", enrolmentConfirmedAt: { gte: thisMonthStart } },
    }),
    // Revenue last month
    db.commission.aggregate({
      _sum: { eduquanticaNet: true },
      where: { status: "PAID", enrolmentConfirmedAt: { gte: lastMonthStart, lt: thisMonthStart } },
    }),

    // Active sub-agents (approved)
    db.subAgent.count({ where: { isApproved: true } }),
    // New approvals this month (for trend)
    db.subAgent.count({ where: { isApproved: true, approvedAt: { gte: thisMonthStart } } }),
    // New approvals last month
    db.subAgent.count({ where: { isApproved: true, approvedAt: { gte: lastMonthStart, lt: thisMonthStart } } }),

    // Pending sub-agents
    db.subAgent.count({ where: { approvalStatus: { in: ["PENDING", "INFO_REQUESTED"] } } }),
    // New pending this month
    db.subAgent.count({
      where: { approvalStatus: { in: ["PENDING", "INFO_REQUESTED"] }, createdAt: { gte: thisMonthStart } },
    }),
    // New pending last month
    db.subAgent.count({
      where: { approvalStatus: { in: ["PENDING", "INFO_REQUESTED"] }, createdAt: { gte: lastMonthStart, lt: thisMonthStart } },
    }),
    db.student.count(),
    db.application.count(),
  ]);

  const revenueThisValue = revenueThis._sum.eduquanticaNet ?? 0;
  const revenueLastValue = revenueLast._sum.eduquanticaNet ?? 0;
  const avgApplicationsPerStudent = totalStudents > 0
    ? Math.round((totalApplications / totalStudents) * 100) / 100
    : 0;

  return NextResponse.json({
    data: {
      leadsThisMonth: {
        value: leadsThis,
        change: pctChange(leadsThis, leadsLast),
      },
      activeApplications: {
        value: activeApps,
        change: pctChange(appsCreatedThis, appsCreatedLast),
      },
      enrolledStudents: {
        value: enrolledTotal,
        change: null, // no enrolledAt timestamp to calculate trend
      },
      revenueThisMonth: {
        value: revenueThisValue,
        change: pctChange(Math.round(revenueThisValue), Math.round(revenueLastValue)),
      },
      activeSubAgents: {
        value: activeSubAgents,
        change: pctChange(newApprovedThis, newApprovedLast),
      },
      pendingSubAgents: {
        value: pendingSubAgents,
        change: pctChange(pendingCreatedThis, pendingCreatedLast),
      },
      totalStudents: {
        value: totalStudents,
        change: null,
      },
      totalApplications: {
        value: totalApplications,
        change: null,
      },
      avgApplicationsPerStudent: {
        value: avgApplicationsPerStudent,
        change: null,
      },
    },
  });
}
