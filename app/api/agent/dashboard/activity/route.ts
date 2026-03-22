import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAgentScope, getAgentStudentWhere } from "@/lib/agent-scope";

function titleFromAction(action: string) {
  if (action.startsWith("status_changed_to_")) {
    const raw = action.replace("status_changed_to_", "");
    return `Application moved to ${raw.replaceAll("_", " ").toLowerCase()}`;
  }
  return action.replaceAll("_", " ");
}

export async function GET() {
  const scope = await getAgentScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const studentWhere = getAgentStudentWhere(scope);

  const [studentIds, applicationRows] = await Promise.all([
    db.student.findMany({ where: studentWhere, select: { id: true }, take: 200 }),
    db.application.findMany({
      where: { student: studentWhere },
      select: { id: true, studentId: true },
      take: 400,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const studentIdList = studentIds.map((item) => item.id);
  const applicationIdList = applicationRows.map((item) => item.id);
  const appStudentMap = new Map(applicationRows.map((item) => [item.id, item.studentId]));

  const logs = await db.activityLog.findMany({
    where: {
      OR: [
        {
          entityType: "student",
          entityId: { in: studentIdList.length ? studentIdList : ["none"] },
        },
        {
          entityType: "application",
          entityId: { in: applicationIdList.length ? applicationIdList : ["none"] },
        },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      action: true,
      details: true,
      entityType: true,
      entityId: true,
      createdAt: true,
      user: {
        select: { name: true },
      },
    },
  });

  const data = logs.map((log) => {
    const studentId = log.entityType === "student" ? log.entityId : appStudentMap.get(log.entityId) || null;
    return {
      id: log.id,
      title: titleFromAction(log.action),
      description: log.details || null,
      actorName: log.user.name || "System",
      createdAt: log.createdAt.toISOString(),
      studentId,
      href: studentId ? `/agent/students/${studentId}` : null,
    };
  });

  return NextResponse.json({ data });
}
