import { NextRequest, NextResponse } from "next/server";
import { getAgentScope } from "@/lib/agent-scope";
import { db } from "@/lib/db";

function orgType(subAgentId: string) {
  return `SUBAGENT_${subAgentId}`;
}

export async function GET(req: NextRequest) {
  const scope = await getAgentScope();
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const periodLabel = req.nextUrl.searchParams.get("periodLabel") || "";

  const rows = await db.kpiResult.findMany({
    where: {
      kpiTarget: { organisationType: orgType(scope.subAgentId) },
      ...(periodLabel ? { periodLabel } : {}),
      ...(scope.isBranchCounsellor ? { staffId: scope.userId } : {}),
    },
    include: {
      staff: { select: { id: true, name: true, email: true } },
      kpiTarget: true,
    },
    orderBy: [{ createdAt: "desc" }],
  });

  const latestByStaff = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!latestByStaff.has(row.staffId)) latestByStaff.set(row.staffId, row);
  }

  const latestRows = Array.from(latestByStaff.values());
  const avg = (selector: (r: (typeof latestRows)[number]) => number) =>
    latestRows.length ? Math.round((latestRows.reduce((sum, row) => sum + selector(row), 0) / latestRows.length) * 100) / 100 : 0;

  return NextResponse.json({
    data: {
      rows: latestRows,
      summary: {
        teamLeadContactRate: avg((r) => r.leadContactRate),
        teamConversionRate: avg((r) => r.overallConversionRate),
        teamEnrollments: latestRows.reduce((sum, row) => sum + row.actualEnrolled, 0),
        teamAchievement: avg((r) => r.achievementPercentage),
      },
    },
  });
}
