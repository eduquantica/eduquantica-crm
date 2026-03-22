import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calculateKpiResults } from "@/lib/kpi-calculator";
import { notifyKpiResult, notifyMonthlyTeamSummary } from "@/lib/kpi-notifications";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const targets = await db.kpiTarget.findMany({
    where: { endDate: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365) } },
    select: { id: true, staffId: true, period: true, periodLabel: true, startDate: true, endDate: true },
  });

  const resultIds: string[] = [];

  for (const target of targets) {
    const result = await calculateKpiResults({
      staffId: target.staffId,
      period: target.period,
      periodLabel: target.periodLabel,
      startDate: target.startDate,
      endDate: target.endDate,
      kpiTargetId: target.id,
    });

    resultIds.push(result.id);
  }

  for (const id of resultIds) {
    await notifyKpiResult(id);
  }

  await notifyMonthlyTeamSummary();

  return NextResponse.json({ ok: true, recalculated: resultIds.length });
}
