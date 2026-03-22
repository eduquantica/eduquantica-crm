"use client";

import { useEffect, useState } from "react";

type PerformancePayload = {
  latest: {
    periodLabel: string;
    leadContactRate: number;
    leadToStudentRate: number;
    studentToOfferRate: number;
    offerToDepositRate: number;
    depositToVisaRate: number;
    visaToEnrolledRate: number;
    overallConversionRate: number;
    achievementPercentage: number;
  };
  teamAverageAchievement: number;
  historical: Array<{ periodLabel: string; achievementPercentage: number; overallConversionRate: number }>;
} | null;

function achievementLabel(value: number) {
  if (value >= 90) return "On Track";
  if (value >= 70) return "Needs Improvement";
  return "Below Target";
}

export default function MyPerformanceCard({ endpoint }: { endpoint: "/api/dashboard/kpi/my-performance" | "/api/agent/kpi/my-performance" }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<PerformancePayload>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(endpoint, { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        setPayload(json.data || null);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load performance");
        setLoading(false);
      });
  }, [endpoint]);

  if (loading) {
    return <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Loading performance...</section>;
  }

  if (error) {
    return <section className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</section>;
  }

  if (!payload?.latest) {
    return <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">No KPI performance data yet.</section>;
  }

  const latest = payload.latest;
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">My Performance</h2>
      <p className="mt-1 text-xs text-slate-500">Period: {latest.periodLabel}</p>
      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-sm">
          <p className="text-xs text-slate-500">Achievement</p>
          <p className="font-semibold text-slate-900">{latest.achievementPercentage.toFixed(2)}% ({achievementLabel(latest.achievementPercentage)})</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-sm">
          <p className="text-xs text-slate-500">Overall Conversion</p>
          <p className="font-semibold text-slate-900">{latest.overallConversionRate.toFixed(2)}%</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-sm">
          <p className="text-xs text-slate-500">Team Average Achievement</p>
          <p className="font-semibold text-slate-900">{payload.teamAverageAchievement.toFixed(2)}%</p>
        </div>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="px-2 py-2">Period</th>
              <th className="px-2 py-2">Achievement</th>
              <th className="px-2 py-2">Conversion</th>
            </tr>
          </thead>
          <tbody>
            {payload.historical.map((row) => (
              <tr key={row.periodLabel} className="border-b border-slate-100">
                <td className="px-2 py-2 text-slate-700">{row.periodLabel}</td>
                <td className="px-2 py-2 text-slate-700">{row.achievementPercentage.toFixed(2)}%</td>
                <td className="px-2 py-2 text-slate-700">{row.overallConversionRate.toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
