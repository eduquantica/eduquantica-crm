"use client";

import { useEffect, useMemo, useState } from "react";

type FunnelStage = {
  key: string;
  name: string;
  count: number;
  conversionRate: number;
  dropOff: number;
  color: "green" | "amber" | "red";
};

type FunnelData = {
  periodLabel: string;
  stages: FunnelStage[];
  overallConversionRate: number;
  bestPerformingStage: { stage: string; fromPreviousRate: number } | null;
  weakestStage: { stage: string; fromPreviousRate: number } | null;
  comparison: {
    periodALabel: string;
    periodBLabel: string;
    rows: Array<{
      stage: string;
      periodACount: number;
      periodBCount: number;
      change: number;
      changePct: number | null;
    }>;
    bestPerformingStage: string;
    biggestDropOff: string;
    overallGrowthPct: number | null;
  } | null;
};

type CompareType = "MONTH" | "QUARTER" | "YEAR";

function colorBadge(color: FunnelStage["color"]) {
  if (color === "green") return "bg-emerald-100 text-emerald-700";
  if (color === "amber") return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
}

function monthOptions() {
  const now = new Date();
  return Array.from({ length: 24 }).map((_, idx) => {
    const valueDate = new Date(now.getFullYear(), now.getMonth() - idx, 1);
    const value = `${valueDate.getFullYear()}-${String(valueDate.getMonth() + 1).padStart(2, "0")}`;
    const label = valueDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    return { value, label };
  });
}

function quarterOptions() {
  const now = new Date();
  return Array.from({ length: 8 }).map((_, idx) => {
    const d = new Date(now.getFullYear(), now.getMonth() - idx * 3, 1);
    const quarter = Math.floor(d.getMonth() / 3) + 1;
    const value = `${d.getFullYear()}-Q${quarter}`;
    return { value, label: `Q${quarter} ${d.getFullYear()}` };
  });
}

function yearOptions() {
  const now = new Date();
  return Array.from({ length: 6 }).map((_, idx) => {
    const year = `${now.getFullYear() - idx}`;
    return { value: year, label: year };
  });
}

function optionsForType(type: CompareType) {
  if (type === "MONTH") return monthOptions();
  if (type === "QUARTER") return quarterOptions();
  return yearOptions();
}

export default function RecruitmentFunnelSection({
  endpoint,
  title,
}: {
  endpoint: "/api/dashboard/funnel-stats" | "/api/agent/dashboard/funnel-stats";
  title: string;
}) {
  const [period, setPeriod] = useState("THIS_MONTH");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FunnelData | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [periodAType, setPeriodAType] = useState<CompareType>("MONTH");
  const [periodBType, setPeriodBType] = useState<CompareType>("MONTH");
  const periodAOptions = useMemo(() => optionsForType(periodAType), [periodAType]);
  const periodBOptions = useMemo(() => optionsForType(periodBType), [periodBType]);
  const [periodAValue, setPeriodAValue] = useState<string>(periodAOptions[0]?.value || "");
  const [periodBValue, setPeriodBValue] = useState<string>(periodBOptions[1]?.value || periodBOptions[0]?.value || "");

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`${endpoint}?period=${period}`, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load funnel");
        return res.json();
      })
      .then((json) => {
        setData(json.data || null);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load funnel");
        setLoading(false);
      });
  }, [endpoint, period]);

  const rows = useMemo(() => data?.stages || [], [data]);

  useEffect(() => {
    const nextOptions = optionsForType(periodAType);
    setPeriodAValue((prev) => (nextOptions.some((option) => option.value === prev) ? prev : (nextOptions[0]?.value || "")));
  }, [periodAType]);

  useEffect(() => {
    const nextOptions = optionsForType(periodBType);
    setPeriodBValue((prev) => (nextOptions.some((option) => option.value === prev) ? prev : (nextOptions[0]?.value || "")));
  }, [periodBType]);

  async function runComparison() {
    try {
      setCompareLoading(true);
      const query = new URLSearchParams({
        period,
        compare: "true",
        periodAType,
        periodAValue,
        periodBType,
        periodBValue,
      });
      const res = await fetch(`${endpoint}?${query.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to compare periods");
      const json = await res.json();
      setData(json.data || null);
    } catch {
      setError("Failed to compare periods");
    } finally {
      setCompareLoading(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-500">Period: {data?.periodLabel || "-"}</p>
        </div>
        <select value={period} onChange={(e) => setPeriod(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="THIS_MONTH">This Month</option>
          <option value="LAST_MONTH">Last Month</option>
          <option value="THIS_QUARTER">This Quarter</option>
          <option value="THIS_YEAR">This Year</option>
        </select>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="grid grid-cols-1 gap-2">{Array.from({ length: 9 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded bg-slate-100" />)}</div>
      ) : !data || rows.length === 0 ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">No funnel data for selected period.</div>
      ) : (
        <div className="space-y-2">
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Stage</th>
                  <th className="px-3 py-2 text-right font-medium">Count</th>
                  <th className="px-3 py-2 text-right font-medium">Conversion</th>
                  <th className="px-3 py-2 text-right font-medium">Drop-off</th>
                  <th className="px-3 py-2 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((stage) => (
                  <tr key={stage.key} className="border-t border-slate-200">
                    <td className="px-3 py-2 font-medium text-slate-900">{stage.name}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{stage.count}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{stage.conversionRate.toFixed(2)}%</td>
                    <td className="px-3 py-2 text-right text-slate-700">{stage.dropOff}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${colorBadge(stage.color)}`}>
                        {stage.color.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 gap-2 pt-2 md:grid-cols-3">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-sm text-slate-700">
              <p className="text-xs text-slate-500">Overall Leads → Enrolled</p>
              <p className="font-semibold">{data.overallConversionRate}%</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-sm text-slate-700">
              <p className="text-xs text-slate-500">Best Stage</p>
              <p className="font-semibold">{data.bestPerformingStage ? `${data.bestPerformingStage.stage} (${data.bestPerformingStage.fromPreviousRate}%)` : "-"}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-sm text-slate-700">
              <p className="text-xs text-slate-500">Weakest Stage</p>
              <p className="font-semibold">{data.weakestStage ? `${data.weakestStage.stage} (${data.weakestStage.fromPreviousRate}%)` : "-"}</p>
            </div>
          </div>

          <div className="mt-3 rounded-md border border-slate-200 p-3">
            <p className="text-sm font-semibold text-slate-900">Period Comparison</p>
            <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="rounded-md border border-slate-200 p-3">
                <p className="text-xs font-medium text-slate-500">Period A</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <select value={periodAType} onChange={(e) => setPeriodAType(e.target.value as CompareType)} className="rounded-md border border-slate-300 px-2 py-2 text-sm">
                    <option value="MONTH">Month/Year</option>
                    <option value="QUARTER">Quarter</option>
                    <option value="YEAR">Full Year</option>
                  </select>
                  <select value={periodAValue} onChange={(e) => setPeriodAValue(e.target.value)} className="rounded-md border border-slate-300 px-2 py-2 text-sm">
                    {periodAOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="rounded-md border border-slate-200 p-3">
                <p className="text-xs font-medium text-slate-500">Period B</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <select value={periodBType} onChange={(e) => setPeriodBType(e.target.value as CompareType)} className="rounded-md border border-slate-300 px-2 py-2 text-sm">
                    <option value="MONTH">Month/Year</option>
                    <option value="QUARTER">Quarter</option>
                    <option value="YEAR">Full Year</option>
                  </select>
                  <select value={periodBValue} onChange={(e) => setPeriodBValue(e.target.value)} className="rounded-md border border-slate-300 px-2 py-2 text-sm">
                    {periodBOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-3">
              <button
                type="button"
                onClick={() => void runComparison()}
                disabled={compareLoading}
                className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {compareLoading ? "Comparing..." : "Compare"}
              </button>
            </div>

            {data.comparison && (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-sm text-slate-700">
                    <p className="text-xs text-slate-500">Best Performing Stage</p>
                    <p className="font-semibold">{data.comparison.bestPerformingStage}</p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-sm text-slate-700">
                    <p className="text-xs text-slate-500">Biggest Drop-off</p>
                    <p className="font-semibold">{data.comparison.biggestDropOff}</p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-sm text-slate-700">
                    <p className="text-xs text-slate-500">Overall Growth</p>
                    <p className={`font-semibold ${(data.comparison.overallGrowthPct || 0) >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                      {data.comparison.overallGrowthPct == null ? "-" : `${data.comparison.overallGrowthPct >= 0 ? "+" : ""}${data.comparison.overallGrowthPct.toFixed(2)}%`}
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-md border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Stage</th>
                        <th className="px-3 py-2 text-right font-medium">{data.comparison.periodALabel}</th>
                        <th className="px-3 py-2 text-right font-medium">{data.comparison.periodBLabel}</th>
                        <th className="px-3 py-2 text-right font-medium">Change</th>
                        <th className="px-3 py-2 text-right font-medium">Change %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.comparison.rows.map((row) => (
                        <tr key={row.stage} className="border-t border-slate-200">
                          <td className="px-3 py-2 font-medium text-slate-900">{row.stage}</td>
                          <td className="px-3 py-2 text-right text-slate-700">{row.periodACount}</td>
                          <td className="px-3 py-2 text-right text-slate-700">{row.periodBCount}</td>
                          <td className={`px-3 py-2 text-right font-medium ${row.change >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                            {row.change >= 0 ? "+" : ""}{row.change}
                          </td>
                          <td className={`px-3 py-2 text-right font-medium ${((row.changePct || 0) >= 0) ? "text-emerald-700" : "text-rose-700"}`}>
                            {row.changePct == null ? "-" : `${row.changePct >= 0 ? "↑" : "↓"} ${Math.abs(row.changePct).toFixed(2)}%`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
