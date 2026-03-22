import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const roleName = session.user.roleName;
  const whereStudent = roleName === "COUNSELLOR" ? { assignedCounsellorId: session.user.id } : undefined;

  const interviews = await db.mockInterview.findMany({
    where: {
      status: "COMPLETED",
      completedAt: { gte: monthStart, lt: nextMonthStart },
      ...(whereStudent ? { student: whereStudent } : {}),
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
