"use client";

import { useState, useMemo } from "react";
import { Download, Upload } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

interface StudentInvoice {
  id: string;
  invoiceNumber: string;
  fileOpeningCharge: number | null;
  serviceCharge: number | null;
  serviceChargeType: string | null;
  serviceInstalment1: number | null;
  serviceInstalment1Desc: string | null;
  serviceInstalment2: number | null;
  serviceInstalment2Desc: string | null;
  ucasFee: number | null;
  applicationFee: number | null;
  applicationFeeDesc: string | null;
  applicationFee2: number | null;
  applicationFee2Desc: string | null;
  airportPickupFee: number | null;
  airportPickupDesc: string | null;
  otherDescription: string | null;
  otherAmount: number | null;
  totalAmount: number;
  currency: string;
  status: string;
  paymentMethod: string | null;
  paidAt: string | null;
  receiptUrl: string | null;
  receiptFileName: string | null;
  notes: string | null;
  createdBy: string;
  createdByRole: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export default function StudentPaymentsPageClient({ studentId }: { studentId: string }) {
  const [uploadingInvoiceId, setUploadingInvoiceId] = useState<string | null>(null);

  const {
    data: invoices = [],
    isLoading,
    error,
    refetch,
  } = useQuery<StudentInvoice[]>({
    queryKey: ["student-invoices-readonly", studentId],
    queryFn: async () => {
      const res = await fetch(`/api/students/${studentId}/invoices`);
      if (!res.ok) throw new Error("Failed to fetch invoices");
      const json = await res.json();
      return Array.isArray(json.data) ? json.data : [];
    },
  });

  const { outstanding, paid } = useMemo(() => {
    return {
      outstanding: invoices.filter((inv) => inv.status === "DUE" || inv.status === "PROOF_UPLOADED"),
      paid: invoices.filter((inv) => inv.status === "PAID"),
    };
  }, [invoices]);

  const handleUploadReceipt = async (invoiceId: string, file: File) => {
    try {
      // Upload file first
      const formData = new FormData();
      formData.append("files", file);

      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) throw new Error("Failed to upload file");

      const uploadJson = await uploadRes.json();
      const receiptUrl = uploadJson.urls?.[0];

      if (!receiptUrl) throw new Error("Failed to get receipt URL");

      // Update invoice with receipt URL
      const res = await fetch(`/api/students/${studentId}/invoices/${invoiceId}/receipt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiptUrl,
          receiptFileName: file.name,
        }),
      });

      if (!res.ok) throw new Error("Failed to upload receipt");

      toast.success("Receipt uploaded. Awaiting staff confirmation.");
      await refetch();
      setUploadingInvoiceId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload receipt");
    }
  };

  return (
    <div className="min-h-screen student-dashboard-bg">
    <div className="space-y-8 max-w-4xl mx-auto px-4 py-6 sm:px-6">
      <div className="glass-card p-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Payments</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">View your invoices and manage payments</p>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          Failed to load some payment data. Please refresh and try again.
        </div>
      )}

      {/* Outstanding Payments Section */}
      <section className="glass-card p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-red-500"></span>
          Outstanding Payments ({outstanding.length})
        </h2>

        {isLoading ? (
          <div className="text-center py-8 text-slate-500">Loading...</div>
        ) : outstanding.length === 0 ? (
          <div className="text-center py-8 text-slate-500">No outstanding payments</div>
        ) : (
          <div className="space-y-4">
            {outstanding.map((invoice: StudentInvoice) => (
              <div key={invoice.id} className="rounded-lg border border-white/40 bg-white/50 dark:border-white/10 dark:bg-white/5 p-4 hover:shadow-sm transition-shadow backdrop-blur-sm">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-mono font-semibold text-slate-900">{invoice.invoiceNumber}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Raised by {invoice.createdByName} on {new Date(invoice.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                      invoice.status === "PROOF_UPLOADED"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {invoice.status}
                  </span>
                </div>

                {/* Charges Breakdown */}
                <div className="mb-4 p-3 bg-slate-50/90 dark:bg-slate-800/60 rounded-lg text-sm space-y-1">
                  {invoice.fileOpeningCharge && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">File Opening Charge</span>
                      <span className="font-semibold">{invoice.currency} {invoice.fileOpeningCharge.toFixed(2)}</span>
                    </div>
                  )}
                  {invoice.serviceCharge && invoice.serviceChargeType === "FULL" && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Service Charge</span>
                      <span className="font-semibold">{invoice.currency} {invoice.serviceCharge.toFixed(2)}</span>
                    </div>
                  )}
                  {invoice.serviceInstalment1 && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">{invoice.serviceInstalment1Desc}</span>
                      <span className="font-semibold">{invoice.currency} {invoice.serviceInstalment1.toFixed(2)}</span>
                    </div>
                  )}
                  {invoice.serviceInstalment2 && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">{invoice.serviceInstalment2Desc}</span>
                      <span className="font-semibold">{invoice.currency} {invoice.serviceInstalment2.toFixed(2)}</span>
                    </div>
                  )}
                  {invoice.ucasFee && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">UCAS Application Fee</span>
                      <span className="font-semibold">{invoice.currency} {invoice.ucasFee.toFixed(2)}</span>
                    </div>
                  )}
                  {invoice.applicationFee && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Application Fee {invoice.applicationFeeDesc && `(${invoice.applicationFeeDesc})`}</span>
                      <span className="font-semibold">{invoice.currency} {invoice.applicationFee.toFixed(2)}</span>
                    </div>
                  )}
                  {invoice.applicationFee2 && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Application Fee {invoice.applicationFee2Desc && `(${invoice.applicationFee2Desc})`}</span>
                      <span className="font-semibold">{invoice.currency} {invoice.applicationFee2.toFixed(2)}</span>
                    </div>
                  )}
                  {invoice.airportPickupFee && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Airport Pickup {invoice.airportPickupDesc && `(${invoice.airportPickupDesc})`}</span>
                      <span className="font-semibold">{invoice.currency} {invoice.airportPickupFee.toFixed(2)}</span>
                    </div>
                  )}
                  {invoice.otherAmount && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">{invoice.otherDescription}</span>
                      <span className="font-semibold">{invoice.currency} {invoice.otherAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="border-t border-slate-200 pt-1 mt-1 flex justify-between font-bold">
                    <span>Total</span>
                    <span>{invoice.currency} {invoice.totalAmount.toFixed(2)}</span>
                  </div>
                </div>

                {/* Upload Receipt */}
                <div className="space-y-2">
                  {invoice.status === "PROOF_UPLOADED" && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                      Receipt uploaded. Awaiting staff confirmation.
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setUploadingInvoiceId(invoice.id)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-blue-200/70 dark:border-blue-400/30 bg-blue-50/90 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-sm font-medium"
                    >
                      <Upload className="w-4 h-4" />
                      {invoice.status === "PROOF_UPLOADED" ? "Replace Receipt" : "Upload Receipt"}
                    </button>

                    {invoice.receiptUrl && (
                      <>
                        <a
                          href={invoice.receiptUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Preview Receipt
                        </a>
                        <a
                          href={invoice.receiptUrl}
                          download={invoice.receiptFileName || `receipt-${invoice.invoiceNumber}`}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Download Receipt
                        </a>
                      </>
                    )}
                  </div>

                  {uploadingInvoiceId === invoice.id && (
                    <div className="flex-1 flex gap-2">
                      <input
                        type="file"
                        accept=".pdf,.jpg,.png,.jpeg"
                        onChange={(e) => {
                          const file = e.currentTarget.files?.[0];
                          if (file) {
                            handleUploadReceipt(invoice.id, file);
                          }
                        }}
                        className="text-sm"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Payment History Section */}
      <section className="glass-card p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-emerald-500"></span>
          Payment History ({paid.length})
        </h2>

        {paid.length === 0 ? (
          <div className="text-center py-8 text-slate-500">No paid invoices</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Invoice No</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Amount</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Paid Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paid.map((invoice: StudentInvoice) => (
                  <tr key={invoice.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-white/5">
                    <td className="px-4 py-3 font-mono font-semibold">{invoice.invoiceNumber}</td>
                    <td className="px-4 py-3">
                      {invoice.currency} {invoice.totalAmount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {invoice.paidAt && new Date(invoice.paidAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                        PAID
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      {invoice.receiptUrl && (
                        <a
                          href={invoice.receiptUrl}
                          download={invoice.receiptFileName}
                          className="inline-flex items-center gap-1 px-2 py-1 text-blue-600 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded text-xs"
                        >
                          <Download className="w-4 h-4" />
                          Receipt
                        </a>
                      )}
                      <button className="inline-flex items-center gap-1 px-2 py-1 text-blue-600 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded text-xs">
                        <Download className="w-4 h-4" />
                        Invoice
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
    </div>
  );
}
