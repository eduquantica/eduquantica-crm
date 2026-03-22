"use client";

import { useEffect, useState } from "react";

type Invoice = {
  id: string;
  invoiceNumber: string;
  submittedAt: string;
  totalAmount: number;
  currency: string;
  status: "SUBMITTED" | "APPROVED" | "PAID" | "REJECTED";
  pdfUrl: string | null;
};

function money(value: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(value || 0);
}

function statusBadge(status: Invoice["status"]) {
  if (status === "PAID") return "bg-emerald-100 text-emerald-700";
  if (status === "APPROVED") return "bg-blue-100 text-blue-700";
  if (status === "REJECTED") return "bg-red-100 text-red-700";
  return "bg-amber-100 text-amber-700";
}

export default function AgentInvoicesPage() {
  const [rows, setRows] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchInvoices() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/agent/invoices");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load invoices");
      setRows(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchInvoices();
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2 m-4">{error}</div>}
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="px-4 py-3">Invoice Number</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Total Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Download PDF</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-4 py-5 text-slate-600" colSpan={5}>Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td className="px-4 py-5 text-slate-600" colSpan={5}>No invoices submitted yet.</td></tr>
            ) : rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-900">{row.invoiceNumber}</td>
                <td className="px-4 py-3">{new Date(row.submittedAt).toLocaleDateString("en-GB")}</td>
                <td className="px-4 py-3">{money(row.totalAmount, row.currency)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${statusBadge(row.status)}`}>
                    {row.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {row.pdfUrl ? (
                    <a href={row.pdfUrl} target="_blank" rel="noopener noreferrer" className="inline-flex rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                      Download
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400">Unavailable</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
