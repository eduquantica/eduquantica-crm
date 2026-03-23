"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type ServicePayStatus = "PENDING" | "PROOF_UPLOADED" | "CONFIRMED" | "REJECTED" | "REFUNDED" | "CANCELLED";

type PaymentRow = {
  id: string;
  studentName: string;
  studentEmail: string | null;
  serviceType: string;
  description: string;
  amount: number;
  currency: string;
  paymentMethod: string | null;
  status: ServicePayStatus;
  paymentProofUrl: string | null;
  paymentProofName: string | null;
  createdAt: string;
  rejectionReason: string | null;
  invoiceUrl: string | null;
};

type PaymentSummary = {
  totalRevenue: number;
  pendingTotal: number;
  confirmedThisMonth: number;
  rejectedTotal: number;
};

type Props = {
  currentUserId?: string;
  onOpenPricingTab: () => void;
};

const statusBadgeClass: Record<ServicePayStatus, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  PROOF_UPLOADED: "bg-blue-100 text-blue-700",
  CONFIRMED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  REFUNDED: "bg-slate-200 text-slate-700",
  CANCELLED: "bg-slate-200 text-slate-700",
};

export default function ServicePaymentsTab({ currentUserId, onOpenPricingTab }: Props) {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [summary, setSummary] = useState<PaymentSummary>({ totalRevenue: 0, pendingTotal: 0, confirmedThisMonth: 0, rejectedTotal: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectingPaymentId, setRejectingPaymentId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/service-payments", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Failed to load payments");
      setRows(Array.isArray(json.data) ? json.data : []);
      setSummary(json.summary || { totalRevenue: 0, pendingTotal: 0, confirmedThisMonth: 0, rejectedTotal: 0 });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load payments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const orderedRows = useMemo(() => rows, [rows]);

  async function confirmPayment(paymentId: string) {
    setUpdatingId(paymentId);
    setError("");
    try {
      const response = await fetch(`/api/admin/service-payments/${paymentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CONFIRMED", confirmedBy: currentUserId || null }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Failed to confirm payment");
      await load();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to confirm payment");
    } finally {
      setUpdatingId(null);
    }
  }

  async function rejectPayment() {
    if (!rejectingPaymentId) return;
    setUpdatingId(rejectingPaymentId);
    setError("");
    try {
      const response = await fetch(`/api/admin/service-payments/${rejectingPaymentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REJECTED", rejectionReason }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Failed to reject payment");
      setRejectingPaymentId(null);
      setRejectionReason("");
      await load();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to reject payment");
    } finally {
      setUpdatingId(null);
    }
  }

  async function generateInvoice(paymentId: string) {
    setUpdatingId(paymentId);
    setError("");
    try {
      const response = await fetch(`/api/admin/service-payments/${paymentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "GENERATE_INVOICE" }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Failed to generate invoice");
      await load();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to generate invoice");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Payments</h2>
        <button type="button" onClick={onOpenPricingTab} className="rounded-md border px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Open Pricing Management
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-md border bg-white p-4">
          <p className="text-sm text-slate-600">Total Revenue</p>
          <p className="mt-2 text-xl font-semibold">GBP {summary.totalRevenue.toFixed(2)}</p>
        </div>
        <div className="rounded-md border bg-white p-4">
          <p className="text-sm text-slate-600">Pending</p>
          <p className="mt-2 text-xl font-semibold">GBP {summary.pendingTotal.toFixed(2)}</p>
        </div>
        <div className="rounded-md border bg-white p-4">
          <p className="text-sm text-slate-600">Confirmed This Month</p>
          <p className="mt-2 text-xl font-semibold">GBP {summary.confirmedThisMonth.toFixed(2)}</p>
        </div>
        <div className="rounded-md border bg-white p-4">
          <p className="text-sm text-slate-600">Rejected</p>
          <p className="mt-2 text-xl font-semibold">GBP {summary.rejectedTotal.toFixed(2)}</p>
        </div>
      </div>

      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {loading ? (
        <p className="text-sm text-slate-600">Loading payments...</p>
      ) : orderedRows.length === 0 ? (
        <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-slate-600">No service payments found.</div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                {["Student", "Service", "Description", "Amount", "Method", "Status", "Proof", "Date", "Actions"].map((label) => (
                  <th key={label} className="px-4 py-3 font-medium">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {orderedRows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{row.studentName}</p>
                    <p className="text-xs text-slate-500">{row.studentEmail || "-"}</p>
                  </td>
                  <td className="px-4 py-3">{row.serviceType}</td>
                  <td className="px-4 py-3">{row.description}</td>
                  <td className="px-4 py-3">{row.currency} {row.amount.toFixed(2)}</td>
                  <td className="px-4 py-3">{row.paymentMethod || "-"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusBadgeClass[row.status]}`}>{row.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    {row.paymentProofUrl ? (
                      <button
                        type="button"
                        onClick={() => window.open(row.paymentProofUrl!, "_blank", "noopener,noreferrer")}
                        className="rounded-md border px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        View Payment Proof
                      </button>
                    ) : (
                      <span className="text-xs text-slate-500">No proof uploaded</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{new Date(row.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {(row.status === "PENDING" || row.status === "PROOF_UPLOADED") ? (
                        <>
                          <button
                            type="button"
                            disabled={updatingId === row.id}
                            onClick={() => void confirmPayment(row.id)}
                            className="rounded-md border border-green-200 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-60"
                          >
                            Confirm Payment
                          </button>
                          <button
                            type="button"
                            disabled={updatingId === row.id}
                            onClick={() => {
                              setRejectingPaymentId(row.id);
                              setRejectionReason(row.rejectionReason || "");
                            }}
                            className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                          >
                            Reject Payment
                          </button>
                        </>
                      ) : null}

                      {row.status === "CONFIRMED" ? (
                        <>
                          <button
                            type="button"
                            disabled={updatingId === row.id}
                            onClick={() => void generateInvoice(row.id)}
                            className="rounded-md border px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-60"
                          >
                            Generate Invoice
                          </button>
                          {row.invoiceUrl ? (
                            <a
                              href={row.invoiceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-md border px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Download Invoice
                            </a>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rejectingPaymentId ? (
        <div className="space-y-3 rounded-md border bg-white p-4">
          <p className="text-sm font-medium text-slate-900">Reject payment</p>
          <textarea
            value={rejectionReason}
            onChange={(event) => setRejectionReason(event.target.value)}
            className="min-h-24 w-full rounded-md border px-3 py-2 text-sm"
            placeholder="Reason for rejection"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setRejectingPaymentId(null)} className="rounded-md border px-3 py-2 text-sm">Cancel</button>
            <button type="button" disabled={!rejectionReason.trim() || updatingId === rejectingPaymentId} onClick={() => void rejectPayment()} className="rounded-md bg-red-600 px-3 py-2 text-sm text-white disabled:opacity-60">Confirm Reject</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
