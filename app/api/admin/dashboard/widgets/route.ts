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

export async function GET() {
  const session = await getServerSession(authOptions);
  const guard = staffGuard(session);
  if (guard) return guard;

  const now = new Date();
  const isCounsellor = session!.user.roleName === "COUNSELLOR";
  const uid = session!.user.id;

  const [activityLogs, upcomingTasks, flaggedDocsCount] = await Promise.all([
    // Last 10 activity log entries — COUNSELLOR sees only their own actions
    db.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      where: isCounsellor ? { userId: uid } : {},
      select: {
        id: true,
        action: true,
        entityType: true,
        details: true,
        createdAt: true,
        user: { select: { name: true } },
      },
    }),

    // Next 5 uncompleted tasks — COUNSELLOR sees only their own tasks
    db.task.findMany({
      where: {
        status: { not: "COMPLETED" },
        dueDate: { not: null },
        ...(isCounsellor ? { userId: uid } : {}),
      },
      orderBy: { dueDate: "asc" },
      take: 5,
      select: {
        id: true,
        title: true,
        dueDate: true,
        student: { select: { firstName: true, lastName: true } },
      },
    }),

    // Flagged documents: HIGH fraud risk + OCR completed
    db.checklistItem.count({
      where: { fraudRiskLevel: "HIGH", ocrStatus: "COMPLETED" },
    }),
  ]);

  // convert and sort so overdue items come first
  const tasksMapped = upcomingTasks
    .map((t) => ({
      id: t.id,
      title: t.title,
      studentName: t.student
        ? `${t.student.firstName} ${t.student.lastName}`
        : null,
      dueDate: t.dueDate?.toISOString() ?? null,
      isOverdue: t.dueDate ? t.dueDate < now : false,
    }))
    .sort((a, b) => {
      if (a.isOverdue === b.isOverdue) return 0;
      return a.isOverdue ? -1 : 1;
    });

  return NextResponse.json({
    data: {
      recentActivity: activityLogs.map((log) => ({
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        details: log.details,
        userName: log.user.name ?? "System",
        createdAt: log.createdAt.toISOString(),
      })),
      upcomingTasks: tasksMapped,
      flaggedDocsCount,
    },
  });
}
