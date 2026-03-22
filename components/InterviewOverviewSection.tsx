"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type Outcome = "PASSED" | "FAILED" | "RESCHEDULED" | "CANCELLED_BY_UNIVERSITY" | "NO_SHOW";

type Payload = {
  preCas: Array<{ outcome: Outcome; count: number }>;
  visa: Array<{ outcome: Outcome; count: number }>;
  passRates: { preCas: number; visa: number };
};

type Props = {
  endpoint: string;
  emptyMessage: string;
};

const COLORS: Record<Outcome, string> = {
  PASSED: "#16a34a",
  FAILED: "#dc2626",
  RESCHEDULED: "#d97706",
  CANCELLED_BY_UNIVERSITY: "#6b7280",
  NO_SHOW: "#7f1d1d",
};

function outcomeLabel(outcome: Outcome) {
  if (outcome === "CANCELLED_BY_UNIVERSITY") return "Cancelled by University";
  if (outcome === "NO_SHOW") return "No Show";
  return outcome[0] + outcome.slice(1).toLowerCase();
}

function Donut({ title, rows }: { title: string; rows: Array<{ outcome: Outcome; count: number }> }) {
  const total = rows.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="mb-2 text-sm font-semibold text-slate-900">{title}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={rows} dataKey="count" nameKey="outcome" cx="50%" cy="50%" outerRadius={82} innerRadius={50}>
              {rows.map((entry) => (
                <Cell key={entry.outcome} fill={COLORS[entry.outcome]} />
              ))}
            </Pie>
            <Tooltip formatter={(value, _name, ctx) => {
              const numeric = Number(value || 0);
              const pct = total > 0 ? ((numeric / total) * 100).toFixed(2) : "0.00";
              return [`${numeric} (${pct}%)`, outcomeLabel((ctx.payload as { outcome: Outcome }).outcome)];
            }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="-mt-28 text-center">
        <p className="text-xs text-slate-500">Total</p>
        <p className="text-2xl font-bold text-slate-900">{total}</p>
      </div>
    </div>
  );
}

export default function InterviewOverviewSection({ endpoint, emptyMessage }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Payload | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(endpoint, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load interview overview");
        if (!active) return;
        setData(json.data || null);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load interview overview");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [endpoint]);

  const totalRows = useMemo(() => {
    if (!data) return 0;
    const preCasTotal = data.preCas.reduce((sum, item) => sum + item.count, 0);
    const visaTotal = data.visa.reduce((sum, item) => sum + item.count, 0);
    return preCasTotal + visaTotal;
  }, [data]);

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Interview Overview</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="h-72 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-72 animate-pulse rounded-lg bg-slate-100" />
        </div>
      </section>
    );
  }

  if (error) {
    return <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>;
  }

  if (!data || totalRows === 0) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Interview Overview</h2>
        <p className="mt-3 text-sm text-slate-600">{emptyMessage}</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">Interview Overview</h2>
      <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Donut title="Pre-CAS Interview Results" rows={data.preCas} />
        <Donut title="Visa Interview Results" rows={data.visa} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 font-medium text-emerald-700">Pre-CAS Pass Rate: {data.passRates.preCas.toFixed(2)}%</span>
        <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 font-medium text-emerald-700">Visa Pass Rate: {data.passRates.visa.toFixed(2)}%</span>
        <Link href="/dashboard/reports?tab=Interview%20Tracking" className="ml-auto text-blue-600 hover:underline">View Full Report</Link>
      </div>
    </section>
  );
}
