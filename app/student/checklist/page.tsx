"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ChecklistItemStatus = "PENDING" | "SCANNING" | "REVISION_REQUIRED" | "VERIFIED" | "REJECTED";

type ChecklistResponse = {
  data: {
    studentName: string;
    checklistId: string | null;
    verifiedCount: number;
    totalCount: number;
    completionPct: number;
    allVerified: boolean;
    certificateUrl: string | null;
    items: Array<{
      id: string;
      label: string;
      documentType: string;
      status: ChecklistItemStatus;
      reason: string | null;
      fileName: string | null;
      fileUrl: string | null;
    }>;
  };
  error?: string;
};

type StatusCounts = {
  pending: number;
  scanning: number;
  needsRevision: number;
  verified: number;
  rejected: number;
};

function getProgressColour(percent: number) {
  if (percent >= 100) return "#10b981";
  if (percent > 0) return "#2563EB";
  return "#9ca3af";
}

export default function ChecklistPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<ChecklistResponse["data"] | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/student/checklist", { cache: "no-store" });
        const json = (await res.json()) as ChecklistResponse;
        if (!res.ok || !json.data) {
          throw new Error(json.error || "Failed to load checklist");
        }
        if (mounted) setPayload(json.data);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "Failed to load checklist");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const counts = useMemo<StatusCounts>(() => {
    const base: StatusCounts = {
      pending: 0,
      scanning: 0,
      needsRevision: 0,
      verified: 0,
      rejected: 0,
    };

    for (const item of payload?.items || []) {
      if (item.status === "PENDING") base.pending += 1;
      else if (item.status === "SCANNING") base.scanning += 1;
      else if (item.status === "REVISION_REQUIRED") base.needsRevision += 1;
      else if (item.status === "VERIFIED") base.verified += 1;
      else if (item.status === "REJECTED") base.rejected += 1;
    }

    return base;
  }, [payload]);

  const total = payload?.totalCount || 0;
  const verified = payload?.verifiedCount || 0;
  const percent = total > 0 ? Math.round((verified / total) * 100) : 0;

  const size = 160;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (percent / 100) * circumference;

  if (loading) {
    return <div className="mx-auto w-full max-w-5xl px-4 py-8 text-sm text-slate-600">Loading checklist...</div>;
  }

  if (error) {
    return <div className="mx-auto w-full max-w-5xl px-4 py-8 text-sm text-red-600">{error}</div>;
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex justify-center">
          <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="#e5e7eb"
                strokeWidth={strokeWidth}
              />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={getProgressColour(percent)}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
              />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <p className="text-3xl font-bold text-slate-900">{verified}/{total}</p>
              <p className="text-xs text-slate-500">Verified</p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-slate-700">
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-400" />Pending: {counts.pending}</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-600" />Scanning: {counts.scanning}</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" />Needs Revision: {counts.needsRevision}</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />Verified: {counts.verified}</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" />Rejected: {counts.rejected}</span>
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-semibold text-slate-900">Checklist Items</h1>
          <Link href="/student/documents" className="text-sm font-medium text-blue-700 hover:underline">
            Open Full Documents Portal
          </Link>
        </div>

        <div className="mt-4 space-y-2">
          {(payload?.items || []).map((item) => (
            <Link key={item.id} href={`/student/checklist/${item.id}`} className="block rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-slate-900">{item.label}</p>
                <span className="text-xs text-slate-500">{item.status.replaceAll("_", " ")}</span>
              </div>
            </Link>
          ))}

          {(!payload?.items || payload.items.length === 0) && (
            <p className="text-sm text-slate-500">No checklist items found.</p>
          )}
        </div>
      </section>
    </main>
  );
}
