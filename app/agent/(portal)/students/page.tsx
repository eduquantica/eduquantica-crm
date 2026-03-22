"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import StudyGapIndicator from "@/components/ui/StudyGapIndicator";
import { AlertTriangle } from "lucide-react";

type Row = {
  id: string;
  studentName: string;
  nationality: string | null;
  applicationsCount: number;
  latestStatus: string;
  dateSubmitted: string;
  profileCompletion: number;
  studyGapIndicator: {
    colour: "GREEN" | "YELLOW" | "RED";
    gapYears: number;
    lastQualification: string;
  };
  hasImmigrationUpdate?: boolean;
  latestMockInterviewResult: "PASS" | "FAIL" | null;
};

function formatStatus(status: string) {
  return status
    .split("_")
    .map((part) => part[0] + part.slice(1).toLowerCase())
    .join(" ");
}

export default function AgentStudentsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [nationality, setNationality] = useState("");
  const [applicationStatus, setApplicationStatus] = useState("");
  const [loading, setLoading] = useState(true);

  async function fetchData() {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (nationality) params.set("nationality", nationality);
    if (applicationStatus) params.set("applicationStatus", applicationStatus);
    const res = await fetch(`/api/agent/students?${params.toString()}`);
    const json = await res.json();
    if (res.ok) setRows(json.data || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nationalityOptions = Array.from(new Set(rows.map((r) => r.nationality).filter(Boolean))) as string[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Students</h1>
          <p className="text-sm text-slate-500 mt-1">Students submitted by your agency.</p>
        </div>
        <Link href="/agent/students/new" className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Add New Student
        </Link>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name"
          className="border rounded-md px-3 py-2 text-sm min-w-[220px]"
        />
        <select value={nationality} onChange={(e) => setNationality(e.target.value)} className="border rounded-md px-3 py-2 text-sm">
          <option value="">All nationalities</option>
          {nationalityOptions.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <select value={applicationStatus} onChange={(e) => setApplicationStatus(e.target.value)} className="border rounded-md px-3 py-2 text-sm">
          <option value="">All statuses</option>
          {[
            "DRAFT",
            "DOCUMENTS_PENDING",
            "SUBMITTED",
            "UNDER_REVIEW",
            "CONDITIONAL_OFFER",
            "UNCONDITIONAL_OFFER",
            "CAS_ISSUED",
            "VISA_APPLIED",
            "VISA_APPROVED",
            "VISA_REJECTED",
            "ENROLLED",
            "WITHDRAWN",
          ].map((s) => (
            <option key={s} value={s}>{formatStatus(s)}</option>
          ))}
        </select>
        <button onClick={fetchData} className="border rounded-md px-3 py-2 text-sm hover:bg-slate-50">Apply</button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        {loading ? (
          <div className="p-6 text-sm text-slate-600">Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-200 text-slate-500">
                <th className="px-4 py-3">Student Name</th>
                <th className="px-4 py-3">Nationality</th>
                <th className="px-4 py-3">Applications Count</th>
                <th className="px-4 py-3">Latest Status</th>
                <th className="px-4 py-3">Date Submitted</th>
                <th className="px-4 py-3">Profile Completion %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="px-4 py-3">
                    <div className="inline-flex items-center gap-2">
                      <Link href={`/agent/students/${row.id}`} className="text-blue-600 hover:underline">{row.studentName}</Link>
                      <StudyGapIndicator colour={row.studyGapIndicator.colour} />
                      {row.hasImmigrationUpdate && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                      {row.latestMockInterviewResult && (
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            row.latestMockInterviewResult === "PASS"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          Mock Interview {row.latestMockInterviewResult}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">{row.nationality || "-"}</td>
                  <td className="px-4 py-3">{row.applicationsCount}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-slate-100 text-slate-700 px-2.5 py-1 text-xs font-medium">
                      {formatStatus(row.latestStatus)}
                    </span>
                  </td>
                  <td className="px-4 py-3">{new Date(row.dateSubmitted).toLocaleDateString("en-GB")}</td>
                  <td className="px-4 py-3">{row.profileCompletion}%</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-slate-500">No students found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
