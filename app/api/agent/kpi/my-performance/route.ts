import { NextResponse } from "next/server";
import { getAgentScope } from "@/lib/agent-scope";
import { db } from "@/lib/db";

function orgType(subAgentId: string) {
  return `SUBAGENT_${subAgentId}`;
}

export async function GET() {
  const scope = await getAgentScope();
  if (!scope || !scope.isBranchCounsellor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const latest = await db.kpiResult.findFirst({
    where: { staffId: scope.userId, kpiTarget: { organisationType: orgType(scope.subAgentId) } },
    include: { kpiTarget: true },
    orderBy: { createdAt: "desc" },
  });

  if (!latest) return NextResponse.json({ data: null });

  const teamAvg = await db.kpiResult.aggregate({
    where: { kpiTarget: { organisationType: orgType(scope.subAgentId) }, periodLabel: latest.periodLabel },
    _avg: { achievementPercentage: true },
  });

  const historical = await db.kpiResult.findMany({
    where: { staffId: scope.userId, kpiTarget: { organisationType: orgType(scope.subAgentId) } },
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
