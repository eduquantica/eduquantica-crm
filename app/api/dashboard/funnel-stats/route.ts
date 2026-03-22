import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getPeriodRangeFromPreset } from "@/lib/kpi-period";
import {
  buildComparison,
  buildRecruitmentFunnel,
  resolveCompareRange,
  type FunnelScope,
} from "@/lib/recruitment-funnel";

function ensureRole(roleName?: string) {
  return roleName === "ADMIN" || roleName === "MANAGER" || roleName === "COUNSELLOR";
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !ensureRole(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const preset = (req.nextUrl.searchParams.get("period") as "THIS_MONTH" | "LAST_MONTH" | "THIS_QUARTER" | "THIS_YEAR" | "CUSTOM" | null) || "THIS_MONTH";
  const customFrom = req.nextUrl.searchParams.get("from");
  const customTo = req.nextUrl.searchParams.get("to");

  const { startDate, endDate, label } = getPeriodRangeFromPreset(preset, customFrom, customTo);

  const scope: FunnelScope = {
    leadWhere: {
      ...(session.user.roleName === "COUNSELLOR" ? { assignedCounsellorId: session.user.id } : {}),
    },
    studentWhere: {
      ...(session.user.roleName === "COUNSELLOR" ? { assignedCounsellorId: session.user.id } : {}),
    },
    applicationWhere: {
      ...(session.user.roleName === "COUNSELLOR" ? { counsellorId: session.user.id } : {}),
    },
  };

  const funnel = await buildRecruitmentFunnel({
    scope,
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
      scope,
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
