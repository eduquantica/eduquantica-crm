import { NextRequest, NextResponse } from "next/server";
import { getAgentScope } from "@/lib/agent-scope";
import { getPeriodRangeFromPreset } from "@/lib/kpi-period";
import {
  buildComparison,
  buildRecruitmentFunnel,
  resolveCompareRange,
  type FunnelScope,
} from "@/lib/recruitment-funnel";

export async function GET(req: NextRequest) {
  const scope = await getAgentScope();
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const preset = (req.nextUrl.searchParams.get("period") as "THIS_MONTH" | "LAST_MONTH" | "THIS_QUARTER" | "THIS_YEAR" | "CUSTOM" | null) || "THIS_MONTH";
  const customFrom = req.nextUrl.searchParams.get("from");
  const customTo = req.nextUrl.searchParams.get("to");

  const { startDate, endDate, label } = getPeriodRangeFromPreset(preset, customFrom, customTo);

  const scopeFilters: FunnelScope = {
    leadWhere: {
      subAgentId: scope.subAgentId,
      ...(scope.isBranchCounsellor ? { assignedCounsellorId: scope.userId } : {}),
    },
    studentWhere: {
      subAgentId: scope.subAgentId,
      ...(scope.isBranchCounsellor ? { assignedCounsellorId: scope.userId } : {}),
    },
    applicationWhere: {
      student: { subAgentId: scope.subAgentId },
      ...(scope.isBranchCounsellor ? { counsellorId: scope.userId } : {}),
    },
  };

  const funnel = await buildRecruitmentFunnel({
    scope: scopeFilters,
    range: { startDate, endDate, label },
  });

  const compare = req.nextUrl.searchParams.get("compare") === "true";
  const periodA = resolveCompareRange(
    req.nextUrl.searchParams.get("periodAType"),
    req.nextUrl.searchParams.get("periodAValue"),
  );
  const periodB = resolveCompareRange(
    req.nextUrl.searchParams.get("periodBType"),
    req.nextUrl.searchParams.get("periodBValue"),
  );

  const comparison = compare && periodA && periodB
    ? await buildComparison({
      scope: scopeFilters,
      periodA,
      periodB,
    })
    : null;

  return NextResponse.json({
    data: {
      periodLabel: label,
      stages: funnel.stages,
      overallConversionRate: funnel.overallConversionRate,
      bestPerformingStage: funnel.bestPerformingStage,
      weakestStage: funnel.weakestStage,
      comparison,
    },
  });
}
