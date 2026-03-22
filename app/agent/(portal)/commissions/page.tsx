"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type FilterStatus = "ALL" | "CALCULATED" | "INVOICED" | "APPROVED" | "PAID";

type CommissionRow = {
  id: string;
  studentName: string;
  university: string;
  course: string;
  intake: string;
  agentRate: number;
  agentAmount: number;
  currency: string;
  status: "CALCULATED" | "INVOICED" | "APPROVED" | "PAID" | "PENDING_ARRIVAL" | "CANCELLED";
};

type Summary = {
  totalEarned: number;
  totalPaid: number;
  pendingPayment: number;
  uninvoiced: number;
};

type BankForm = {
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  sortCode: string;
  swiftOrIban: string;
  paypalEmail: string;
};

function money(value: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(value || 0);
}

function statusBadge(status: CommissionRow["status"]) {
  if (status === "PAID") return "bg-emerald-100 text-emerald-700";
  if (status === "APPROVED") return "bg-blue-100 text-blue-700";
  if (status === "INVOICED") return "bg-violet-100 text-violet-700";
  if (status === "CALCULATED") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

export default function AgentCommissionsPage() {
  const [filter, setFilter] = useState<FilterStatus>("ALL");
  const [rows, setRows] = useState<CommissionRow[]>([]);
  const [summary, setSummary] = useState<Summary>({ totalEarned: 0, totalPaid: 0, pendingPayment: 0, uninvoiced: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [submittingInvoice, setSubmittingInvoice] = useState(false);
  const [statementMonth, setStatementMonth] = useState(new Date().toISOString().slice(0, 7));
  const [downloadingStatement, setDownloadingStatement] = useState(false);

  const [bankForm, setBankForm] = useState<BankForm>({
    accountHolderName: "",
    bankName: "",
    accountNumber: "",
    sortCode: "",
    swiftOrIban: "",
    paypalEmail: "",
  });

  async function fetchData(nextFilter: FilterStatus) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/agent/commissions?status=${nextFilter}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load commissions");
      setRows(json.data.rows || []);
      setSummary(json.data.summary || { totalEarned: 0, totalPaid: 0, pendingPayment: 0, uninvoiced: 0 });
      setSelectedIds([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load commissions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData(filter);
  }, [filter]);

  const selectedRows = useMemo(() => rows.filter((row) => selectedIds.includes(row.id)), [rows, selectedIds]);
  const selectedTotal = selectedRows.reduce((sum, row) => sum + row.agentAmount, 0);
  const selectedCurrency = selectedRows[0]?.currency || "GBP";

  function toggleSelect(id: string, checked: boolean) {
    setSelectedIds((current) => {
      if (checked) return Array.from(new Set([...current, id]));
      return current.filter((value) => value !== id);
    });
  }

  async function submitInvoice(e: React.FormEvent) {
    e.preventDefault();
    if (selectedIds.length === 0) return;

    setSubmittingInvoice(true);
    setError(null);
    try {
      const res = await fetch("/api/agent/commissions/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commissionIds: selectedIds,
          bankDetails: bankForm,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create invoice");

      setShowInvoiceForm(false);
      setSelectedIds([]);
      await fetchData(filter);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create invoice");
    } finally {
      setSubmittingInvoice(false);
    }
  }

  async function downloadStatement() {
    setDownloadingStatement(true);
    setError(null);
    try {
      const res = await fetch(`/api/agent/commissions/statement?month=${encodeURIComponent(statementMonth)}`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed to download statement");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `commission-statement-${statementMonth}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download statement");
    } finally {
      setDownloadingStatement(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Commissions</h1>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={statementMonth}
            onChange={(e) => setStatementMonth(e.target.value)}
            className="border border-slate-300 rounded-md px-3 py-2 text-sm"
          />
          <button
            onClick={downloadStatement}
            disabled={downloadingStatement}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {downloadingStatement ? "Downloading..." : "Download Statement"}
          </button>
          <Link href="/agent/invoices" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
            View Invoices
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card title="Total Earned" value={money(summary.totalEarned)} />
        <Card title="Total Paid" value={money(summary.totalPaid)} />
        <Card title="Pending Payment" value={money(summary.pendingPayment)} />
        <Card title="Uninvoiced" value={money(summary.uninvoiced)} />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">{error}</div>}

        <div className="flex flex-wrap items-center gap-2">
          {(["ALL", "CALCULATED", "INVOICED", "APPROVED", "PAID"] as FilterStatus[]).map((value) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`rounded-md px-3 py-1.5 text-sm border ${filter === value ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"}`}
            >
              {value[0] + value.slice(1).toLowerCase()}
            </button>
          ))}

          <button
            onClick={() => setShowInvoiceForm(true)}
            disabled={selectedIds.length === 0}
            className="ml-auto rounded-md bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            Create Invoice
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="px-3 py-2"></th>
                <th className="px-3 py-2">Student Name</th>
                <th className="px-3 py-2">University</th>
                <th className="px-3 py-2">Course</th>
                <th className="px-3 py-2">Intake</th>
                <th className="px-3 py-2">Your Rate %</th>
                <th className="px-3 py-2">Your Amount</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="px-3 py-5 text-slate-600" colSpan={8}>Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td className="px-3 py-5 text-slate-600" colSpan={8}>No commissions found.</td></tr>
              ) : rows.map((row) => {
                const selectable = row.status === "CALCULATED";
                return (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        disabled={!selectable}
                        checked={selectedIds.includes(row.id)}
                        onChange={(e) => toggleSelect(row.id, e.target.checked)}
                      />
                    </td>
                    <td className="px-3 py-2">{row.studentName}</td>
                    <td className="px-3 py-2">{row.university}</td>
                    <td className="px-3 py-2">{row.course}</td>
                    <td className="px-3 py-2">{row.intake}</td>
                    <td className="px-3 py-2">{row.agentRate.toFixed(2)}%</td>
                    <td className="px-3 py-2">{money(row.agentAmount, row.currency)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${statusBadge(row.status)}`}>
                        {row.status.replace(/_/g, " ")}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showInvoiceForm && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-xl border border-slate-200 p-5 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Create Invoice</h2>
              <button onClick={() => setShowInvoiceForm(false)} className="text-sm text-slate-500 hover:text-slate-700">Close</button>
            </div>

            <form onSubmit={submitInvoice} className="space-y-5">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-900">Bank Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input required placeholder="Account holder name" className="border rounded-md px-3 py-2 text-sm" value={bankForm.accountHolderName} onChange={(e) => setBankForm((f) => ({ ...f, accountHolderName: e.target.value }))} />
                  <input required placeholder="Bank name" className="border rounded-md px-3 py-2 text-sm" value={bankForm.bankName} onChange={(e) => setBankForm((f) => ({ ...f, bankName: e.target.value }))} />
                  <input required placeholder="Account number" className="border rounded-md px-3 py-2 text-sm" value={bankForm.accountNumber} onChange={(e) => setBankForm((f) => ({ ...f, accountNumber: e.target.value }))} />
                  <input placeholder="Sort code (UK)" className="border rounded-md px-3 py-2 text-sm" value={bankForm.sortCode} onChange={(e) => setBankForm((f) => ({ ...f, sortCode: e.target.value }))} />
                  <input placeholder="SWIFT / IBAN (International)" className="border rounded-md px-3 py-2 text-sm" value={bankForm.swiftOrIban} onChange={(e) => setBankForm((f) => ({ ...f, swiftOrIban: e.target.value }))} />
                  <input placeholder="PayPal email (optional)" type="email" className="border rounded-md px-3 py-2 text-sm" value={bankForm.paypalEmail} onChange={(e) => setBankForm((f) => ({ ...f, paypalEmail: e.target.value }))} />
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-900">Invoice Preview</h3>
                <div className="overflow-x-auto border border-slate-200 rounded-md">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500 border-b border-slate-200">
                        <th className="px-3 py-2">Student</th>
                        <th className="px-3 py-2">University</th>
                        <th className="px-3 py-2">Course</th>
                        <th className="px-3 py-2">Intake</th>
                        <th className="px-3 py-2">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRows.map((row) => (
                        <tr key={row.id} className="border-b border-slate-100">
                          <td className="px-3 py-2">{row.studentName}</td>
                          <td className="px-3 py-2">{row.university}</td>
                          <td className="px-3 py-2">{row.course}</td>
                          <td className="px-3 py-2">{row.intake}</td>
                          <td className="px-3 py-2">{money(row.agentAmount, row.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-right text-sm font-semibold text-slate-900">Total: {money(selectedTotal, selectedCurrency)}</p>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submittingInvoice || selectedIds.length === 0}
                  className="rounded-md bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {submittingInvoice ? "Generating..." : "Generate and Submit Invoice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <p className="text-xs font-medium text-slate-500">{title}</p>
      <p className="text-xl font-bold text-slate-900 mt-2">{value}</p>
    </div>
  );
}
