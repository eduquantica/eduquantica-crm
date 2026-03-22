"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  Upload,
  Download,
  UserCheck,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { getScoreColorClass } from "@/lib/lead-scoring";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface LeadRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  source: string;
  status: string;
  score: number;
  createdAt: string;
  assignedCounsellor: { id: string; name: string | null } | null;
  subAgent: { id: string; agencyName: string } | null;
}

interface Filters {
  search: string;
  status: string;
  source: string;
  counsellorId: string;
  allocation: string;
  subAgentId: string;
  from: string;
  to: string;
  page: number;
}

const DEFAULT_FILTERS: Filters = {
  search: "",
  status: "",
  source: "",
  counsellorId: "",
  allocation: "",
  subAgentId: "",
  from: "",
  to: "",
  page: 1,
};

type AllocationPerformanceRow = {
  counsellorId: string;
  counsellorName: string;
  leadsAllocated: number;
  leadsContacted: number;
  leadsConvertedToStudents: number;
  contactRate: number;
  conversionRate: number;
};

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  NEW:       { label: "New",       className: "bg-slate-100 text-slate-600" },
  CONTACTED: { label: "Contacted", className: "bg-blue-100 text-blue-700"  },
  QUALIFIED: { label: "Interested",className: "bg-amber-100 text-amber-700"},
  CONVERTED: { label: "Converted", className: "bg-teal-100 text-teal-700"  },
  LOST:      { label: "Lost",      className: "bg-red-100 text-red-600"    },
  // Potential future extension:
  APPLIED:   { label: "Applied",   className: "bg-purple-100 text-purple-700" },
  ENROLLED:  { label: "Enrolled",  className: "bg-green-100 text-green-700"   },
};

const SOURCE_LABELS: Record<string, string> = {
  FACEBOOK:  "Facebook",
  INSTAGRAM: "Instagram",
  WHATSAPP:  "WhatsApp",
  GOOGLE_ADS:"Google Ads",
  WEBSITE:   "Website",
  REFERRAL:  "Referral",
  WALK_IN:   "Walk-in",
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function buildParams(filters: Filters, extra: Record<string, string> = {}): URLSearchParams {
  const p = new URLSearchParams();
  if (filters.search)      p.set("search",      filters.search);
  if (filters.status)      p.set("status",      filters.status);
  if (filters.source)      p.set("source",      filters.source);
  if (filters.counsellorId)p.set("counsellorId",filters.counsellorId);
  if (filters.allocation)  p.set("allocation",  filters.allocation);
  if (filters.subAgentId)  p.set("subAgentId",  filters.subAgentId);
  if (filters.from)        p.set("from",        filters.from);
  if (filters.to)          p.set("to",          filters.to);
  p.set("page", String(filters.page));
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  return p;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB");
}

// ─── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, className: "bg-slate-100 text-slate-600" };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap", cfg.className)}>
      {cfg.label}
    </span>
  );
}

// ─── Score badge ───────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const className = getScoreColorClass(score);
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap border", className)}>
      {score}
    </span>
  );
}

// ─── Table skeleton ────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 10 }).map((_, i) => (
        <tr key={i} className="border-b border-slate-100">
          {Array.from({ length: 10 }).map((__, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-3.5 bg-slate-200 rounded animate-pulse" style={{ width: `${50 + (j * 13 + i * 7) % 40}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ─── Paginator ─────────────────────────────────────────────────────────────────

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

  // Build visible page numbers with ellipsis
  const range = 2;
  const rawPages: number[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - range && i <= page + range)) {
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
          <span key={`gap-${i}`} className="px-1 text-slate-400 text-sm select-none">
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

// ─── Filter bar sub-components ─────────────────────────────────────────────────

function Select({
  value,
  onChange,
  placeholder,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 cursor-pointer"
    >
      <option value="">{placeholder}</option>
      {children}
    </select>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

interface LeadsClientProps {
  role: string;
  counsellors: { id: string; name: string }[];
  subAgents: { id: string; agencyName: string }[];
  apiBasePath?: string;
  detailBasePath?: string;
  addLeadHref?: string;
  showImportButton?: boolean;
}

export default function LeadsClient({
  role,
  counsellors,
  subAgents,
  apiBasePath = "/api/admin/leads",
  detailBasePath = "/dashboard/leads",
  addLeadHref = "/dashboard/leads/new",
  showImportButton = role === "ADMIN" || role === "MANAGER",
}: LeadsClientProps) {
  const isCounsellor = role === "COUNSELLOR" || role === "SUB_AGENT_COUNSELLOR";
  const canAllocate = role === "ADMIN" || role === "MANAGER";
  const canCreateLead = ["ADMIN", "MANAGER", "SUB_AGENT", "BRANCH_MANAGER"].includes(role);

  // ── Filter state ─────────────────────────────────────────────────────────
  const [pendingSearch, setPendingSearch] = useState("");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [activeTab, setActiveTab] = useState<"leads" | "allocationPerformance">("leads");

  // ── Data state ───────────────────────────────────────────────────────────
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [allocationSaving, setAllocationSaving] = useState(false);
  const [allocationNotes, setAllocationNotes] = useState("");
  const [allocationTargetId, setAllocationTargetId] = useState("");
  const [allocationLeadId, setAllocationLeadId] = useState<string | null>(null);
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [showBulkAllocateModal, setShowBulkAllocateModal] = useState(false);
  const [performanceRows, setPerformanceRows] = useState<AllocationPerformanceRow[]>([]);

  // ── Debounce search input into filters ──────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => ({ ...f, search: pendingSearch, page: 1 }));
    }, 400);
    return () => clearTimeout(t);
  }, [pendingSearch]);

  // ── Fetch leads when filters change ─────────────────────────────────────
  const cancelRef = useRef<boolean>(false);
  useEffect(() => {
    if (activeTab !== "leads") return;

    cancelRef.current = false;
    setLoading(true);
    setError(null);

    fetch(`${apiBasePath}?${buildParams(filters)}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelRef.current) return;
        setLeads(j.data.leads ?? []);
        setTotal(j.data.total ?? 0);
        setTotalPages(j.data.totalPages ?? 0);
        setLoading(false);
      })
      .catch(() => {
        if (cancelRef.current) return;
        setError("Failed to load leads. Please try again.");
        setLoading(false);
      });

    return () => {
      cancelRef.current = true;
    };
  }, [filters, activeTab, apiBasePath]);

  useEffect(() => {
    if (activeTab !== "allocationPerformance") return;
    setLoading(true);
    setError(null);
    fetch("/api/dashboard/leads/allocation/performance", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        setPerformanceRows(json.data || []);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load allocation performance");
        setLoading(false);
      });
  }, [activeTab]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  function updateFilter<K extends keyof Omit<Filters, "page" | "search">>(key: K, value: string) {
    setFilters((f) => ({ ...f, [key]: value, page: 1 }));
  }

  function setPage(p: number) {
    setFilters((f) => ({ ...f, page: p }));
  }

  function clearFilters() {
    setPendingSearch("");
    setFilters(DEFAULT_FILTERS);
    setSelectedLeadIds([]);
  }

  const hasActiveFilters =
    pendingSearch !== "" ||
    filters.status !== "" ||
    filters.source !== "" ||
    filters.counsellorId !== "" ||
    filters.allocation !== "" ||
    filters.subAgentId !== "" ||
    filters.from !== "" ||
    filters.to !== "";

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch(`${apiBasePath}?${buildParams(filters, { export: "true" })}`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // silent — could show a toast here in a future iteration
    } finally {
      setExporting(false);
    }
  }

  // ── Pagination counters ──────────────────────────────────────────────────
  const firstItem = total === 0 ? 0 : (filters.page - 1) * 25 + 1;
  const lastItem = Math.min(filters.page * 25, total);

  function openAllocateModal(leadId: string) {
    setAllocationLeadId(leadId);
    setAllocationTargetId("");
    setAllocationNotes("");
    setShowAllocateModal(true);
  }

  async function submitAllocate(single: boolean) {
    if (!allocationTargetId) return;
    setAllocationSaving(true);
    setError(null);
    try {
      const body = single
        ? { leadId: allocationLeadId, allocatedToId: allocationTargetId, notes: allocationNotes || null }
        : { leadIds: selectedLeadIds, allocatedToId: allocationTargetId, notes: allocationNotes || null };

      const res = await fetch("/api/dashboard/leads/allocation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to allocate lead(s)");

      setShowAllocateModal(false);
      setShowBulkAllocateModal(false);
      setAllocationLeadId(null);
      setSelectedLeadIds([]);
      setAllocationTargetId("");
      setAllocationNotes("");
      setFilters((prev) => ({ ...prev }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to allocate lead(s)");
    } finally {
      setAllocationSaving(false);
    }
  }

  const allVisibleIds = leads.map((lead) => lead.id);
  const allSelectedOnPage = allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedLeadIds.includes(id));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("leads")}
          className={cn(
            "rounded-md px-3 py-2 text-sm font-medium",
            activeTab === "leads" ? "bg-blue-600 text-white" : "border border-slate-300 text-slate-700 hover:bg-slate-50",
          )}
        >
          Leads
        </button>
        {(role === "ADMIN" || role === "MANAGER") && (
          <button
            type="button"
            onClick={() => setActiveTab("allocationPerformance")}
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium",
              activeTab === "allocationPerformance" ? "bg-blue-600 text-white" : "border border-slate-300 text-slate-700 hover:bg-slate-50",
            )}
          >
            Allocation Performance
          </button>
        )}
      </div>

      {activeTab === "leads" && (
      <>
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Leads</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage and track your lead pipeline</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
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
          {showImportButton && (
            <Link
              href="/dashboard/leads/import"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Import CSV
            </Link>
          )}
          {canCreateLead && (
            <Link
              href={addLeadHref}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors hover:opacity-90"
              style={{ backgroundColor: "#1E3A5F" }}
            >
              <Plus className="w-4 h-4" />
              Add Lead
            </Link>
          )}
          {canAllocate && (
            <button
              type="button"
              onClick={() => setShowBulkAllocateModal(true)}
              disabled={selectedLeadIds.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              <UserCheck className="w-4 h-4" />
              Bulk Allocate
            </button>
          )}
        </div>
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={pendingSearch}
              onChange={(e) => setPendingSearch(e.target.value)}
              placeholder="Search name, email or phone…"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            />
          </div>

          {/* Status */}
          <Select value={filters.status} onChange={(v) => updateFilter("status", v)} placeholder="All Statuses">
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </Select>

          {/* Source */}
          <Select value={filters.source} onChange={(v) => updateFilter("source", v)} placeholder="All Sources">
            {Object.entries(SOURCE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>

          {/* Counsellor — hidden for counsellor role */}
          {!isCounsellor && (
            <Select value={filters.counsellorId} onChange={(v) => updateFilter("counsellorId", v)} placeholder="All Counsellors">
              {counsellors.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          )}

          {!isCounsellor && (
            <Select value={filters.allocation} onChange={(v) => updateFilter("allocation", v)} placeholder="Allocation">
              <option value="UNALLOCATED">Unallocated</option>
              <option value="ME">Allocated to me</option>
              {counsellors.map((c) => (
                <option key={c.id} value={c.id}>Allocated to {c.name}</option>
              ))}
            </Select>
          )}

          {/* Sub-Agent */}
          {subAgents.length > 0 && (
            <Select value={filters.subAgentId} onChange={(v) => updateFilter("subAgentId", v)} placeholder="All Sub-Agents">
              {subAgents.map((s) => (
                <option key={s.id} value={s.id}>{s.agencyName}</option>
              ))}
            </Select>
          )}

          {/* Date range */}
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={filters.from}
              onChange={(e) => updateFilter("from", e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              title="From date"
            />
            <span className="text-slate-400 text-xs">to</span>
            <input
              type="date"
              value={filters.to}
              min={filters.from || undefined}
              onChange={(e) => updateFilter("to", e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              title="To date"
            />
          </div>

          {/* Clear filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Results summary ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          {loading ? (
            "Loading…"
          ) : total === 0 ? (
            "No leads found"
          ) : (
            <>
              Showing <span className="font-medium text-slate-700">{firstItem}–{lastItem}</span> of{" "}
              <span className="font-medium text-slate-700">{total.toLocaleString()}</span> leads
            </>
          )}
        </span>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {canAllocate && (
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={allSelectedOnPage}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedLeadIds((prev) => Array.from(new Set([...prev, ...allVisibleIds])));
                        } else {
                          setSelectedLeadIds((prev) => prev.filter((id) => !allVisibleIds.includes(id)));
                        }
                      }}
                    />
                  </th>
                )}
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Nationality</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Source</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Counsellor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Sub-Agent</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Score</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Date Added</th>
                {canAllocate && <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Allocate</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSkeleton />
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={canAllocate ? 12 : 10} className="px-4 py-12 text-center text-slate-400">
                    {hasActiveFilters
                      ? "No leads match your filters. Try adjusting or clearing them."
                      : "No leads yet. Click 'Add Lead' to get started."}
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                  >
                    {canAllocate && (
                      <td className="px-4 py-3 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedLeadIds.includes(lead.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedLeadIds((prev) => [...prev, lead.id]);
                            } else {
                              setSelectedLeadIds((prev) => prev.filter((id) => id !== lead.id));
                            }
                          }}
                        />
                      </td>
                    )}
                    {/* Name */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link
                        href={`${detailBasePath}/${lead.id}`}
                        className="font-medium text-blue-700 hover:text-blue-900 hover:underline"
                      >
                        {lead.firstName} {lead.lastName}
                      </Link>
                    </td>

                    {/* Email */}
                    <td className="px-4 py-3 text-slate-600 max-w-[180px] truncate">
                      {lead.email ?? <span className="text-slate-300">—</span>}
                    </td>

                    {/* Phone */}
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {lead.phone ?? <span className="text-slate-300">—</span>}
                    </td>

                    {/* Nationality */}
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {lead.nationality ?? <span className="text-slate-300">—</span>}
                    </td>

                    {/* Source */}
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {SOURCE_LABELS[lead.source] ?? lead.source}
                    </td>

                    {/* Assigned Counsellor */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {lead.assignedCounsellor?.name ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                          {lead.assignedCounsellor.name}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                          Unassigned
                        </span>
                      )}
                    </td>

                    {/* Sub-Agent */}
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {lead.subAgent?.agencyName ?? <span className="text-slate-300">—</span>}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <StatusBadge status={lead.status} />
                    </td>

                    {/* Score */}
                    <td className="px-4 py-3">
                      <ScoreBadge score={lead.score} />
                    </td>

                    {/* Date Added */}
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {formatDate(lead.createdAt)}
                    </td>
                    {canAllocate && (
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openAllocateModal(lead.id)}
                          className="text-xs font-medium text-blue-700 hover:underline"
                        >
                          Allocate
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pagination ─────────────────────────────────────────────────────── */}
      {totalPages > 1 && !loading && (
        <div className="flex justify-center pt-1">
          <Paginator page={filters.page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}
      </>
      )}

      {activeTab === "allocationPerformance" && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Counsellor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Leads Allocated</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Leads Contacted</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Leads Converted</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Contact Rate</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Conversion Rate</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSkeleton />
              ) : performanceRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">No allocation performance data yet.</td>
                </tr>
              ) : (
                performanceRows.map((row) => (
                  <tr key={row.counsellorId} className="border-b border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-800">{row.counsellorName}</td>
                    <td className="px-4 py-3 text-slate-700">{row.leadsAllocated}</td>
                    <td className="px-4 py-3 text-slate-700">{row.leadsContacted}</td>
                    <td className="px-4 py-3 text-slate-700">{row.leadsConvertedToStudents}</td>
                    <td className="px-4 py-3 text-slate-700">{row.contactRate}%</td>
                    <td className="px-4 py-3 text-slate-700">{row.conversionRate}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showAllocateModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">Allocate Lead</h3>
            <p className="mt-1 text-sm text-slate-600">Assign this lead to a counsellor.</p>
            <div className="mt-4 space-y-3">
              <select
                value={allocationTargetId}
                onChange={(e) => setAllocationTargetId(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Select counsellor</option>
                {counsellors.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <textarea
                value={allocationNotes}
                onChange={(e) => setAllocationNotes(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Notes (optional)"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setShowAllocateModal(false)} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">Cancel</button>
              <button type="button" onClick={() => submitAllocate(true)} disabled={allocationSaving || !allocationTargetId} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Allocate</button>
            </div>
          </div>
        </div>
      )}

      {showBulkAllocateModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">Bulk Allocate Leads</h3>
            <p className="mt-1 text-sm text-slate-600">Allocate {selectedLeadIds.length} selected lead(s).</p>
            <div className="mt-4 space-y-3">
              <select
                value={allocationTargetId}
                onChange={(e) => setAllocationTargetId(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Select counsellor</option>
                {counsellors.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <textarea
                value={allocationNotes}
                onChange={(e) => setAllocationNotes(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Notes (optional)"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setShowBulkAllocateModal(false)} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">Cancel</button>
              <button type="button" onClick={() => submitAllocate(false)} disabled={allocationSaving || !allocationTargetId || selectedLeadIds.length === 0} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Allocate All</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
