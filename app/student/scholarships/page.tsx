"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CurrencyDisplay from "@/components/CurrencyDisplay";

type ScholarshipTrackerRow = {
  id: string;
  status: "INTERESTED" | "APPLIED" | "SHORTLISTED" | "AWARDED" | "REJECTED";
  appliedAt: string | null;
  awardedAmount: number | null;
  awardLetterUrl: string | null;
  notes: string | null;
  counsellorNote: string | null;
  scholarship: {
    id: string;
    name: string;
    amount: number;
    amountType: "FIXED" | "PERCENTAGE";
    percentageOf: "TUITION" | "LIVING" | "TOTAL" | null;
    currency: string;
    deadline: string | null;
    university: { id: string; name: string };
    course: { id: string; name: string } | null;
  };
};

export default function StudentScholarshipsTrackerPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ScholarshipTrackerRow[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/student/scholarships", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load scholarship tracker");
        setRows(json.data || []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load scholarship tracker");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  return (
    <main className="w-full space-y-6 px-5 py-6 sm:px-7">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Scholarships</h1>
          <p className="text-sm text-slate-600">Track all scholarships you marked as interested or applied.</p>
        </div>
        <Link href="/student/courses" className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
          Find Scholarships
        </Link>
      </div>

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600">Loading tracker...</div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-500">No scholarship items tracked yet.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-600">
                <th className="px-4 py-3">Scholarship</th>
                <th className="px-4 py-3">University</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Deadline</th>
                <th className="px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{row.scholarship.name}</p>
                    {row.scholarship.course && (
                      <p className="text-xs text-slate-500">{row.scholarship.course.name}</p>
                    )}
                    {row.scholarship.course?.id ? (
                      <Link href={`/student/courses/${row.scholarship.course.id}`} className="text-xs text-blue-700 hover:underline">
                        View Course
                      </Link>
                    ) : (
                      <span className="text-xs text-slate-500">University-wide scholarship</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{row.scholarship.university.name}</td>
                  <td className="px-4 py-3">
                    {row.scholarship.amountType === "PERCENTAGE" ? (
                      `${row.scholarship.amount}% (${row.scholarship.percentageOf || "TOTAL"})`
                    ) : (
                      <CurrencyDisplay amount={row.scholarship.amount} baseCurrency={row.scholarship.currency} />
                    )}
                    {row.status === "AWARDED" && row.awardedAmount != null && (
                      <p className="mt-1 text-xs text-emerald-700">Awarded: {row.awardedAmount.toLocaleString()} {row.scholarship.currency}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{row.status}</span>
                    {row.appliedAt && <p className="mt-1 text-xs text-slate-500">Applied {new Date(row.appliedAt).toLocaleDateString("en-GB")}</p>}
                  </td>
                  <td className="px-4 py-3">{row.scholarship.deadline ? new Date(row.scholarship.deadline).toLocaleDateString("en-GB") : "-"}</td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-slate-600">{row.notes || "-"}</p>
                    {row.counsellorNote && <p className="mt-1 text-xs text-blue-700">Counsellor: {row.counsellorNote}</p>}
                    {row.awardLetterUrl && (
                      <a href={row.awardLetterUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-emerald-700 hover:underline">
                        Award letter
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
