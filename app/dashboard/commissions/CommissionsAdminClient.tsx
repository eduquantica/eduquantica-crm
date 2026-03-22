"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  currency: string;
  submittedAt: string;
  pdfUrl: string | null;
  status: "SUBMITTED" | "APPROVED" | "PAID" | "REJECTED";
  adminNote: string | null;
  paymentRef: string | null;
  paidAt: string | null;
  subAgent: {
    agencyName: string;
    user: { email: string; name: string | null };
  };
};

type CommissionRow = {
  id: string;
  applicationId: string;
  subAgentId: string | null;
  studentName: string;
  university: string;
  course: string;
  agencyName: string;
  currency: string;
  grossCommission: number;
  agentRate: number | null;
  agentAmount: number | null;
  uiStatus: "PENDING_ARRIVAL" | "CALCULATED" | "INVOICED" | "APPROVED" | "PAID" | "CANCELLED";
  status: "PENDING_ARRIVAL" | "CALCULATED" | "INVOICED" | "PAID" | "CANCELLED";
  visaApprovedAt: string | null;
  enrolmentConfirmedAt: string | null;
  createdAt: string;
};

type PendingRow = {
  id: string;
  studentName: string;
  university: string;
  course: string;
  agencyName: string;
  currency: string;
  visaApprovedAt: string | null;
  createdAt: string;
};

type ChartRow = {
  month: string;
  pendingArrival: number;
  calculated: number;
  invoiced: number;
  paid: number;
};

type DashboardResponse = {
  summary: {
    totalCommissions: number;
    pendingArrivalCount: number;
    invoicedAmount: number;
    paidAmount: number;
  };
  chart: ChartRow[];
  filters: {
    subAgents: Array<{ id: string; agencyName: string }>;
  };
  tables: {
    allCommissions: CommissionRow[];
    pendingArrival: PendingRow[];
    invoices: InvoiceRow[];
  };
};

type TabKey = "all" | "pending" | "invoices";

function money(value: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(value || 0);
}

function invoiceBadge(status: InvoiceRow["status"]) {
  if (status === "PAID") return "bg-emerald-100 text-emerald-700";
  if (status === "APPROVED") return "bg-blue-100 text-blue-700";
  if (status === "REJECTED") return "bg-red-100 text-red-700";
  return "bg-amber-100 text-amber-700";
}

function commissionBadge(status: CommissionRow["uiStatus"]) {
  if (status === "PAID") return "bg-emerald-100 text-emerald-700";
  if (status === "APPROVED") return "bg-blue-100 text-blue-700";
  if (status === "INVOICED") return "bg-blue-100 text-blue-700";
  if (status === "CALCULATED") return "bg-violet-100 text-violet-700";
  if (status === "CANCELLED") return "bg-red-100 text-red-700";
  return "bg-amber-100 text-amber-700";
}

export default function CommissionsAdminClient() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("all");

  const [search, setSearch] = useState("");
  const [subAgentId, setSubAgentId] = useState("ALL");
  const [month, setMonth] = useState("");
  const [commissionStatus, setCommissionStatus] = useState("ALL");
  const [invoiceStatus, setInvoiceStatus] = useState("ALL");

  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const [payingId, setPayingId] = useState<string | null>(null);
  const [commissionPayingId, setCommissionPayingId] = useState<string | null>(null);
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentDate, setPaymentDate] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (subAgentId !== "ALL") params.set("subAgentId", subAgentId);
    if (month) params.set("month", month);
    if (commissionStatus !== "ALL") params.set("commissionStatus", commissionStatus);
    if (invoiceStatus !== "ALL") params.set("invoiceStatus", invoiceStatus);
    return params.toString();
  }, [search, subAgentId, month, commissionStatus, invoiceStatus]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/commissions${query ? `?${query}` : ""}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load commissions data");
      setData(json.data || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load commissions data");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRows();
    }, 200);
    return () => clearTimeout(timer);
  }, [fetchRows]);

  async function runAction(id: string, payload: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/commissions/invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Action failed");
      setRejectingId(null);
      setRejectReason("");
      setPayingId(null);
      setPaymentDate("");
      setPaymentReference("");
      await fetchRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setSaving(false);
    }
  }

  async function exportData(format: "csv" | "pdf") {
    setExporting(format);
    setError(null);
    try {
      const params = new URLSearchParams(query);
      params.set("tab", tab);
      params.set("format", format);
      const res = await fetch(`/api/admin/commissions/export?${params.toString()}`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Export failed");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `commissions-${tab}-${new Date().toISOString().slice(0, 10)}.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(null);
    }
  }

  async function exportReceipt(commissionId: string) {
    setExporting("pdf");
    setError(null);
    try {
      const res = await fetch(`/api/admin/commissions/${commissionId}/receipt`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Receipt export failed");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `commission-receipt-${commissionId}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Receipt export failed");
    } finally {
      setExporting(null);
    }
  }

  async function markCommissionPaid() {
    if (!commissionPayingId || !paymentReference.trim() || !paymentDate) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/commissions/${commissionPayingId}/mark-paid`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentReference, paymentDate }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to mark commission paid");

      setCommissionPayingId(null);
      setPaymentDate("");
      setPaymentReference("");
      await fetchRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark commission paid");
    } finally {
      setSaving(false);
    }
  }

  const allCommissions = data?.tables.allCommissions || [];
  const pendingRows = data?.tables.pendingArrival || [];
  const invoiceRows = data?.tables.invoices || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Commissions</h1>
          <p className="text-sm text-slate-600 mt-1">Track commission lifecycle, pending arrivals, and invoice payouts.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => exportData("csv")}
            disabled={exporting !== null}
            className="px-3 py-2 text-sm rounded-md border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
          >
            {exporting === "csv" ? "Exporting..." : "Export CSV"}
          </button>
          <button
            onClick={() => exportData("pdf")}
            disabled={exporting !== null}
            className="px-3 py-2 text-sm rounded-md border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
          >
            {exporting === "pdf" ? "Exporting..." : "Export PDF"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Total Commissions</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{data?.summary.totalCommissions ?? 0}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Pending Arrival</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{data?.summary.pendingArrivalCount ?? 0}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Invoiced Amount</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{money(data?.summary.invoicedAmount || 0)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Paid Amount</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{money(data?.summary.paidAmount || 0)}</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-slate-900 mb-2">Commissions Trend (Last 12 Months)</h2>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.chart || []} margin={{ top: 8, right: 12, left: -8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar stackId="a" dataKey="pendingArrival" name="Pending Arrival" fill="#f59e0b" radius={[2, 2, 0, 0]} />
              <Bar stackId="a" dataKey="calculated" name="Calculated" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
              <Bar stackId="a" dataKey="invoiced" name="Invoiced" fill="#3b82f6" radius={[2, 2, 0, 0]} />
              <Bar stackId="a" dataKey="paid" name="Paid" fill="#10b981" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student, agency, university, invoice"
            className="min-w-[220px] flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm"
          />
          <select
            value={subAgentId}
            onChange={(e) => setSubAgentId(e.target.value)}
            className="border border-slate-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="ALL">All Agencies</option>
            {(data?.filters.subAgents || []).map((agent) => (
              <option key={agent.id} value={agent.id}>{agent.agencyName}</option>
            ))}
          </select>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="border border-slate-300 rounded-md px-3 py-2 text-sm"
          />
          {tab === "invoices" ? (
            <select
              value={invoiceStatus}
              onChange={(e) => setInvoiceStatus(e.target.value)}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="ALL">All Invoice Statuses</option>
              <option value="SUBMITTED">SUBMITTED</option>
              <option value="APPROVED">APPROVED</option>
              <option value="PAID">PAID</option>
              <option value="REJECTED">REJECTED</option>
            </select>
          ) : (
            <select
              value={commissionStatus}
              onChange={(e) => setCommissionStatus(e.target.value)}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="ALL">All Commission Statuses</option>
              <option value="PENDING_ARRIVAL">PENDING_ARRIVAL</option>
              <option value="CALCULATED">CALCULATED</option>
              <option value="INVOICED">INVOICED</option>
              <option value="PAID">PAID</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl">
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="flex gap-6">
            <button
              onClick={() => setTab("all")}
              className={`text-sm font-medium pb-2 border-b-2 ${tab === "all" ? "text-blue-600 border-blue-600" : "text-slate-600 border-transparent hover:text-slate-900"}`}
            >
              All Commissions
            </button>
            <button
              onClick={() => setTab("pending")}
              className={`text-sm font-medium pb-2 border-b-2 ${tab === "pending" ? "text-blue-600 border-blue-600" : "text-slate-600 border-transparent hover:text-slate-900"}`}
            >
              Pending Arrival
            </button>
            <button
              onClick={() => setTab("invoices")}
              className={`text-sm font-medium pb-2 border-b-2 ${tab === "invoices" ? "text-blue-600 border-blue-600" : "text-slate-600 border-transparent hover:text-slate-900"}`}
            >
              Invoices
            </button>
          </div>
        </div>

        {error && <div className="mx-4 mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">{error}</div>}

        {tab === "all" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Agency</th>
                  <th className="px-4 py-3">University</th>
                  <th className="px-4 py-3">Gross</th>
                  <th className="px-4 py-3">Agent Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="px-4 py-5 text-slate-600">Loading...</td></tr>
                ) : allCommissions.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-5 text-slate-600">No commissions found.</td></tr>
                ) : allCommissions.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-900">{row.studentName}</td>
                    <td className="px-4 py-3">{row.agencyName}</td>
                    <td className="px-4 py-3">{row.university}</td>
                    <td className="px-4 py-3">{money(row.grossCommission, row.currency)}</td>
                    <td className="px-4 py-3">{money(row.agentAmount || 0, row.currency)}</td>
                    <td className="px-4 py-3"><span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${commissionBadge(row.status)}`}>{row.uiStatus}</span></td>
                    <td className="px-4 py-3">{new Date(row.createdAt).toLocaleDateString("en-GB")}</td>
                    <td className="px-4 py-3">
                      <details className="relative">
                        <summary className="list-none cursor-pointer inline-flex items-center justify-center rounded-md border border-slate-300 w-8 h-8 text-slate-700 hover:bg-slate-50">
                          ⋮
                        </summary>
                        <div className="absolute right-0 z-20 mt-1 min-w-[190px] rounded-md border border-slate-200 bg-white shadow-sm p-1">
                          <Link href={`/dashboard/applications/${row.applicationId}`} className="block rounded px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50">
                            View Application
                          </Link>
                          {row.subAgentId && (
                            <Link href={`/dashboard/sub-agents/${row.subAgentId}`} className="block rounded px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50">
                              View Sub-Agent
                            </Link>
                          )}
                          {row.uiStatus === "APPROVED" && (
                            <button
                              onClick={() => {
                                setCommissionPayingId(row.id);
                                setPaymentDate(new Date().toISOString().slice(0, 10));
                              }}
                              className="w-full text-left rounded px-2 py-1.5 text-xs text-blue-700 hover:bg-blue-50"
                            >
                              Mark as Paid
                            </button>
                          )}
                          <button
                            onClick={() => exportReceipt(row.id)}
                            className="w-full text-left rounded px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                          >
                            Export This Row
                          </button>
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "pending" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Agency</th>
                  <th className="px-4 py-3">University</th>
                  <th className="px-4 py-3">Course</th>
                  <th className="px-4 py-3">Visa Approved</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-5 text-slate-600">Loading...</td></tr>
                ) : pendingRows.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-5 text-slate-600">No pending-arrival commissions found.</td></tr>
                ) : pendingRows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-900">{row.studentName}</td>
                    <td className="px-4 py-3">{row.agencyName}</td>
                    <td className="px-4 py-3">{row.university}</td>
                    <td className="px-4 py-3">{row.course}</td>
                    <td className="px-4 py-3">{row.visaApprovedAt ? new Date(row.visaApprovedAt).toLocaleDateString("en-GB") : "-"}</td>
                    <td className="px-4 py-3">{new Date(row.createdAt).toLocaleDateString("en-GB")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "invoices" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="px-4 py-3">Invoice Number</th>
                  <th className="px-4 py-3">Agency</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Date Submitted</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-5 text-slate-600">Loading...</td></tr>
                ) : invoiceRows.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-5 text-slate-600">No invoices found.</td></tr>
                ) : invoiceRows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-900">{row.invoiceNumber}</td>
                    <td className="px-4 py-3">{row.subAgent.agencyName}</td>
                    <td className="px-4 py-3">{money(row.totalAmount, row.currency)}</td>
                    <td className="px-4 py-3">{new Date(row.submittedAt).toLocaleDateString("en-GB")}</td>
                    <td className="px-4 py-3"><span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${invoiceBadge(row.status)}`}>{row.status}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {row.pdfUrl && (
                          <a href={row.pdfUrl} target="_blank" rel="noreferrer" className="rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 px-2 py-1 text-xs">View PDF</a>
                        )}
                        {row.status === "SUBMITTED" && (
                          <>
                            <button disabled={saving} onClick={() => runAction(row.id, { action: "approve" })} className="rounded-md border border-emerald-300 text-emerald-700 hover:bg-emerald-50 px-2 py-1 text-xs disabled:opacity-50">Approve</button>
                            <button disabled={saving} onClick={() => setRejectingId(row.id)} className="rounded-md border border-red-300 text-red-700 hover:bg-red-50 px-2 py-1 text-xs disabled:opacity-50">Reject</button>
                          </>
                        )}
                        {(row.status === "APPROVED" || row.status === "SUBMITTED") && (
                          <button disabled={saving} onClick={() => setPayingId(row.id)} className="rounded-md border border-blue-300 text-blue-700 hover:bg-blue-50 px-2 py-1 text-xs disabled:opacity-50">Mark as Paid</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {rejectingId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 p-4 w-full max-w-md space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Reject Invoice</h2>
            <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={4} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="Rejection reason" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setRejectingId(null)} className="px-3 py-1.5 rounded-md border border-slate-300 text-xs">Cancel</button>
              <button disabled={!rejectReason.trim() || saving} onClick={() => runAction(rejectingId, { action: "reject", reason: rejectReason })} className="px-3 py-1.5 rounded-md bg-red-600 text-white text-xs disabled:opacity-50">Reject</button>
            </div>
          </div>
        </div>
      )}

      {payingId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 p-4 w-full max-w-md space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Mark Invoice as Paid</h2>
            <input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="Payment reference" />
            <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setPayingId(null)} className="px-3 py-1.5 rounded-md border border-slate-300 text-xs">Cancel</button>
              <button disabled={!paymentReference.trim() || !paymentDate || saving} onClick={() => runAction(payingId, { action: "mark_paid", paymentReference, paymentDate })} className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs disabled:opacity-50">Mark Paid</button>
            </div>
          </div>
        </div>
      )}

      {commissionPayingId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 p-4 w-full max-w-md space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Mark Commission as Paid</h2>
            <input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="Payment reference" />
            <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setCommissionPayingId(null)} className="px-3 py-1.5 rounded-md border border-slate-300 text-xs">Cancel</button>
              <button disabled={!paymentReference.trim() || !paymentDate || saving} onClick={markCommissionPaid} className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs disabled:opacity-50">Mark Paid</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
