import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAgentScope, getAgentStudentWhere } from "@/lib/agent-scope";

export async function GET() {
  const scope = await getAgentScope();
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const interviews = await db.mockInterview.findMany({
    where: {
      status: "COMPLETED",
      completedAt: { gte: monthStart, lt: nextMonthStart },
      student: getAgentStudentWhere(scope),
    },
    include: {
      report: {
        select: {
          isPassed: true,
          overallScore: true,
        },
      },
    },
  });

  const completed = interviews.length;
  const passed = interviews.filter((row) => row.report?.isPassed).length;
  const needingSupport = interviews.filter((row) => !row.report?.isPassed || (row.report?.overallScore || 0) < 60).length;
  const passRate = completed > 0 ? Math.round((passed / completed) * 10000) / 100 : 0;

  return NextResponse.json({
    data: {
      completed,
      passRate,
      needingSupport,
    },
  });
}
