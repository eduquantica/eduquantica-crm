"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  Download,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/cn";
import StudyGapIndicator from "@/components/ui/StudyGapIndicator";

interface StudentRow {
  id: string;
  studentNumber?: number | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  nationality: string | null;
  assignedCounsellor: { id: string; name: string | null } | null;
  subAgent: { id: string; agencyName: string } | null;
  _count: { applications: number };
  profileCompletion: number;
  cvCompletion: number;
  cvLastUpdatedAt: string | null;
  hasCvProfile: boolean;
  studyGapIndicator: {
    colour: "GREEN" | "YELLOW" | "RED";
    gapYears: number;
    lastQualification: string;
  };
  latestMockInterviewResult: "PASS" | "FAIL" | null;
  createdAt: string;
}

interface Filters {
  search: string;
  nationality: string;
  counsellorId: string;
  subAgentId: string;
  profileCompletion: string;
  from: string;
  to: string;
  page: number;
}

const DEFAULT_FILTERS: Filters = {
  search: "",
  nationality: "",
  counsellorId: "",
  subAgentId: "",
  profileCompletion: "",
  from: "",
  to: "",
  page: 1,
};

function buildParams(filters: Filters, extra: Record<string, string> = {}): URLSearchParams {
  const p = new URLSearchParams();
  if (filters.search) p.set("search", filters.search);
  if (filters.nationality) p.set("nationality", filters.nationality);
  if (filters.counsellorId) p.set("counsellorId", filters.counsellorId);
  if (filters.subAgentId) p.set("subAgentId", filters.subAgentId);
  if (filters.profileCompletion) p.set("profileCompletion", filters.profileCompletion);
  if (filters.from) p.set("from", filters.from);
  if (filters.to) p.set("to", filters.to);
  p.set("page", String(filters.page));
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  return p;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB");
}

function Paginator({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  const range = 2;
  const rawPages: number[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= page - range && i <= page + range)
    ) {
      rawPages.push(i);
    }
  }
  const withGaps: (number | "…")[] = [];
  let prev = 0;
  for (const n of rawPages) {
    if (n - prev > 1) withGaps.push("…");
    withGaps.push(n);
    prev = n;
  }
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        Previous
      </button>
      {withGaps.map((item, i) =>
        item === "…" ? (
          <span
            key={`gap-${i}`}
            className="px-1 text-slate-400 text-sm select-none"
          >
            …
          </span>
        ) : (
          <button
            key={item}
            onClick={() => onPageChange(item)}
            className={cn(
              "min-w-[32px] h-8 rounded-lg text-sm font-medium transition-colors",
              item === page
                ? "text-white"
                : "text-slate-600 hover:bg-slate-100",
            )}
            style={item === page ? { backgroundColor: "#1E3A5F" } : undefined}
          >
            {item}
          </button>
        ),
      )}
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Next
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

import { useModulePermissions } from "@/lib/permissions";

export default function StudentsClient({
  role,
  counsellors,
  subAgents,
}: {
  role: string;
  counsellors: Array<{ id: string; name: string }>;
  subAgents: Array<{ id: string; agencyName: string }>;
}) {
  const perms = useModulePermissions("students");
  const isCounsellor = role === "COUNSELLOR";
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  async function fetchData() {
    setLoading(true);
    const params = buildParams(filters);
    const res = await fetch(`/api/admin/students?${params.toString()}`);
    if (res.ok) {
      const { data } = await res.json();
      setStudents(data.students);
      setTotalPages(data.totalPages);
      setTotal(data.total);
      setPage(data.page);
    }
    setLoading(false);
  }

  function updateFilter<K extends keyof Filters>(key: K, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  }

  function clearFilters() {
    setFilters(DEFAULT_FILTERS);
  }

  function handleExport() {
    setExporting(true);
    const params = buildParams(filters, { export: "true" });
    window.location.href = `/api/admin/students?${params.toString()}`;
    setTimeout(() => setExporting(false), 1000);
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Students</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage student profiles</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={exporting || loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Export
          </button>
          {perms.canCreate && (
            <Link
              href="/dashboard/students/new"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors hover:opacity-90"
              style={{ backgroundColor: "#1E3A5F" }}
            >
              <Plus className="w-4 h-4" />
              Add Student
            </Link>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => updateFilter("search", e.target.value)}
              placeholder="Search name, email or student number…"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            />
          </div>

          {/* Nationality */}
          <select
            value={filters.nationality}
            onChange={(e) => updateFilter("nationality", e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
          >
            <option value="">All Nationalities</option>
            {/* simple hardcoded list? or maybe dynamic later */}
            <option>USA</option>
            <option>UK</option>
            <option>Canada</option>
            <option>Australia</option>
          </select>

          {/* Counsellor filter */}
          {!isCounsellor && (
            <select
              value={filters.counsellorId}
              onChange={(e) => updateFilter("counsellorId", e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
            >
              <option value="">All Counsellors</option>
              {counsellors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}

          {/* Sub-Agent filter */}
          <select
            value={filters.subAgentId}
            onChange={(e) => updateFilter("subAgentId", e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
          >
            <option value="">All Sub-Agents</option>
            {subAgents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.agencyName}
              </option>
            ))}
          </select>

          {/* Profile completion */}
          <select
            value={filters.profileCompletion}
            onChange={(e) => updateFilter("profileCompletion", e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
          >
            <option value="">All Profiles</option>
            <option value="complete">Complete</option>
            <option value="partial">Partial</option>
            <option value="incomplete">Incomplete</option>
          </select>

          {/* Date range */}
          <input
            type="date"
            value={filters.from}
            onChange={(e) => updateFilter("from", e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
          />
          <input
            type="date"
            value={filters.to}
            onChange={(e) => updateFilter("to", e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
          />

          <button
            onClick={clearFilters}
            className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-600 hover:bg-slate-50"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Student ID</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Phone</th>
              <th className="px-4 py-3 text-left">Nationality</th>
              <th className="px-4 py-3 text-left">Counsellor</th>
              <th className="px-4 py-3 text-left">Sub-Agent</th>
              <th className="px-4 py-3 text-center">Applications</th>
              <th className="px-4 py-3 text-center">Profile %</th>
              <th className="px-4 py-3 text-center">CV %</th>
              <th className="px-4 py-3 text-left">CV Updated</th>
              <th className="px-4 py-3 text-left">CV Actions</th>
              <th className="px-4 py-3 text-left">Date Added</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={13} className="p-4 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                </td>
              </tr>
            ) : students.length === 0 ? (
              <tr>
                <td colSpan={13} className="p-4 text-center text-slate-500">
                  No students found
                </td>
              </tr>
            ) : (
              students.map((s) => (
                <tr key={s.id} className="border-b border-slate-100">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/dashboard/students/${s.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {s.firstName} {s.lastName}
                      </Link>
                      <StudyGapIndicator colour={s.studyGapIndicator.colour} />
                      {s.latestMockInterviewResult && (
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            s.latestMockInterviewResult === "PASS"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          Mock Interview {s.latestMockInterviewResult}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">{s.studentNumber ?? "—"}</td>
                  <td className="px-4 py-3">{s.email}</td>
                  <td className="px-4 py-3">{s.phone || ""}</td>
                  <td className="px-4 py-3">{s.nationality}</td>
                  <td className="px-4 py-3">
                    {s.assignedCounsellor?.name || "Unassigned"}
                  </td>
                  <td className="px-4 py-3">
                    {s.subAgent && (
                      <span className="inline-block bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">
                        {s.subAgent.agencyName}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {s._count.applications}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="w-16 bg-slate-200 h-2 rounded">
                      <div
                        className="h-2 bg-green-500 rounded"
                        style={{ width: `${s.profileCompletion}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-600">
                      {s.profileCompletion}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm font-semibold text-[#1B2A4A]">{s.cvCompletion}%</span>
                  </td>
                  <td className="px-4 py-3">{s.cvLastUpdatedAt ? formatDate(s.cvLastUpdatedAt) : "-"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/dashboard/cv-builder?studentId=${s.id}`}
                        className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Edit CV
                      </Link>
                      <Link
                        href={`/dashboard/cv-builder?studentId=${s.id}`}
                        className="rounded bg-[#F5A623] px-2 py-1 text-xs font-medium text-white hover:opacity-95"
                      >
                        Download PDF
                      </Link>
                    </div>
                  </td>
                  <td className="px-4 py-3">{formatDate(s.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-between items-center">
        <p className="text-sm text-slate-500">
          Showing {students.length} of {total} students
        </p>
        <Paginator
          page={page}
          totalPages={totalPages}
          onPageChange={(p) => updateFilter("page", String(p))}
        />
      </div>
    </div>
  );
}
