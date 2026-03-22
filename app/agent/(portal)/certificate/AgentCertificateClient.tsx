"use client";

import { useEffect, useMemo, useState } from "react";

type CertificatePayload = {
  currentTier: "SILVER" | "GOLD" | "PLATINUM" | null;
  tierAchievedAt: string | null;
  certificateIssuedAt: string | null;
  certificateUrl: string | null;
  kpiAchievementPercentage: number;
  nextTier: "SILVER" | "GOLD" | "PLATINUM" | null;
  nextTarget: number | null;
  nextTierText: string;
  colors: Record<string, string>;
  history: Array<{
    id: string;
    tier: "SILVER" | "GOLD" | "PLATINUM";
    certificateNumber: string;
    certificateUrl: string;
    issuedAt: string;
    validUntil: string;
    achievementPct: number;
    reason: string | null;
    isManual: boolean;
  }>;
};

const TIER_ICON: Record<string, string> = {
  NO_TIER: "⏳",
  SILVER: "🥈",
  GOLD: "🥇",
  PLATINUM: "💎",
};

export default function AgentCertificateClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CertificatePayload | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/agent/certificate", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load certificate");
        if (active) setData(json.data);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Failed to load certificate");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  const progressWidth = useMemo(() => {
    if (!data) return 0;
    if (!data.nextTarget) return Math.max(0, Math.min(100, data.kpiAchievementPercentage));
    const ratio = (data.kpiAchievementPercentage / data.nextTarget) * 100;
    return Math.max(0, Math.min(100, ratio));
  }, [data]);

  const tierLabel = data?.currentTier || "NO_TIER";
  const guidanceText = data?.currentTier === "SILVER"
    ? "Great start. Keep building to 85% KPI achievement for GOLD status."
    : data?.currentTier === "GOLD"
      ? "Strong performance. Reach 90% KPI achievement to unlock PLATINUM."
      : data?.currentTier === "PLATINUM"
        ? "Top tier achieved. Maintain your performance to retain PLATINUM status."
        : "No tier yet. You are working towards SILVER (80%).";

  async function copyShareLink() {
    if (!data?.certificateUrl) return;
    await navigator.clipboard.writeText(data.certificateUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  if (loading) {
    return <div className="p-6 text-sm text-slate-600">Loading certificate...</div>;
  }

  if (error || !data) {
    return <div className="p-6 text-sm text-red-600">{error || "Failed to load certificate."}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Partner Certificate</h1>
        <p className="text-sm text-slate-600">Your current partner tier, certificate and progress to the next tier.</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Current Tier</p>
            <div
              className="mt-1 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold"
              style={{ backgroundColor: `${data.colors[tierLabel]}22`, color: data.colors[tierLabel] }}
            >
              <span>{TIER_ICON[tierLabel]}</span>
              <span>{data.currentTier || "NO TIER YET"}</span>
            </div>
          </div>
          <div className="text-sm text-slate-600">
            {data.tierAchievedAt ? `Achieved on ${new Date(data.tierAchievedAt).toLocaleDateString("en-GB")}` : "Working towards Silver"}
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
            <span>{data.nextTarget ? `Progress to ${data.nextTier}` : "KPI Progress"}</span>
            <span>{data.kpiAchievementPercentage}%{data.nextTarget ? ` / ${data.nextTarget}%` : ""}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-200">
            <div className="h-2 rounded-full bg-blue-600" style={{ width: `${progressWidth}%` }} />
          </div>
          <p className="mt-2 text-sm text-slate-600">{guidanceText}</p>
          <p className="mt-1 text-xs text-slate-500">{data.nextTierText}</p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Certificate Preview</h2>

        {data.certificateUrl ? (
          <>
            <div className="mt-3 h-[520px] overflow-hidden rounded-lg border border-slate-200">
              <iframe title="Partner certificate" src={data.certificateUrl} className="h-full w-full" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={data.certificateUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Download Certificate
              </a>
              <button
                onClick={copyShareLink}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                {copied ? "Share Link Copied" : "Share Certificate"}
              </button>
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-slate-500">Your certificate appears after you reach SILVER tier (80% KPI achievement).</p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Certificate History</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-2 py-2">Tier</th>
                <th className="px-2 py-2">Certificate #</th>
                <th className="px-2 py-2">Issued</th>
                <th className="px-2 py-2">Valid Until</th>
                <th className="px-2 py-2">KPI %</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {data.history.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="px-2 py-2">
                    <span style={{ color: data.colors[row.tier] }} className="font-medium">
                      {TIER_ICON[row.tier]} {row.tier}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-slate-700">{row.certificateNumber}</td>
                  <td className="px-2 py-2 text-slate-700">{new Date(row.issuedAt).toLocaleDateString("en-GB")}</td>
                  <td className="px-2 py-2 text-slate-700">{new Date(row.validUntil).toLocaleDateString("en-GB")}</td>
                  <td className="px-2 py-2 text-slate-700">{row.achievementPct}%</td>
                  <td className="px-2 py-2 text-right">
                    <a href={row.certificateUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                      Download
                    </a>
                  </td>
                </tr>
              ))}
              {data.history.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-2 py-6 text-center text-slate-500">
                    No certificates issued yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
