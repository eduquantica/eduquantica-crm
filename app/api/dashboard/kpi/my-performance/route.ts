import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.roleName !== "COUNSELLOR" && session.user.roleName !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const latest = await db.kpiResult.findFirst({
    where: { staffId: session.user.id, kpiTarget: { organisationType: "EDUQUANTICA" } },
    include: { kpiTarget: true },
    orderBy: { createdAt: "desc" },
  });

  if (!latest) return NextResponse.json({ data: null });

  const teamAvg = await db.kpiResult.aggregate({
    where: { kpiTarget: { organisationType: "EDUQUANTICA" }, periodLabel: latest.periodLabel },
    _avg: { achievementPercentage: true },
  });

  const historical = await db.kpiResult.findMany({
    where: { staffId: session.user.id, kpiTarget: { organisationType: "EDUQUANTICA" } },
    orderBy: { startDate: "asc" },
    take: 6,
    select: { periodLabel: true, achievementPercentage: true, overallConversionRate: true },
  });

  return NextResponse.json({
    data: {
      latest,
      teamAverageAchievement: Math.round((teamAvg._avg.achievementPercentage || 0) * 100) / 100,
      historical,
    },
  });
}
