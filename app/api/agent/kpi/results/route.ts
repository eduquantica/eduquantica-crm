import { NextRequest, NextResponse } from "next/server";
import { getAgentScope } from "@/lib/agent-scope";
import { db } from "@/lib/db";
import { calculateKpiResults } from "@/lib/kpi-calculator";

function orgType(subAgentId: string) {
  return `SUBAGENT_${subAgentId}`;
}

export async function GET(req: NextRequest) {
  const scope = await getAgentScope();
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const periodLabel = req.nextUrl.searchParams.get("periodLabel") || "";
  const staffId = req.nextUrl.searchParams.get("staffId") || "";

  const results = await db.kpiResult.findMany({
    where: {
      kpiTarget: { organisationType: orgType(scope.subAgentId) },
      ...(periodLabel ? { periodLabel } : {}),
      ...(staffId ? { staffId } : {}),
      ...(scope.isBranchCounsellor ? { staffId: scope.userId } : {}),
    },
    include: {
      staff: { select: { id: true, name: true, email: true } },
      kpiTarget: true,
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return NextResponse.json({ data: results });
}

export async function POST(req: NextRequest) {
  const scope = await getAgentScope();
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (scope.isBranchCounsellor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const targetId = body.targetId as string;
  if (!targetId) return NextResponse.json({ error: "targetId is required" }, { status: 400 });

  const target = await db.kpiTarget.findUnique({ where: { id: targetId } });
  if (!target || target.organisationType !== orgType(scope.subAgentId)) {
    return NextResponse.json({ error: "KPI target not found" }, { status: 404 });
  }

  const result = await calculateKpiResults({
    staffId: target.staffId,
    period: target.period,
    periodLabel: target.periodLabel,
    startDate: target.startDate,
    endDate: target.endDate,
    kpiTargetId: target.id,
  });

  return NextResponse.json({ ok: true, data: result });
}
