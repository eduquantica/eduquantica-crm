"use client";

import { useState, useMemo } from "react";
import { ChevronDown, Eye, Edit2, AlertCircle, Trash2, X, Check } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

interface StudentPaymentsTabProps {
  studentId: string;
  currentUserRole: string;
  currentUserName?: string;
  agencyName?: string;
  agencyLogo?: string;
}

interface PaymentMethod {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
}

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

const CURRENCIES = [
  { code: "GBP", symbol: "£" },
  { code: "USD", symbol: "$" },
  { code: "EUR", symbol: "€" },
  { code: "CAD", symbol: "$" },
  { code: "AUD", symbol: "$" },
  { code: "BDT", symbol: "৳" },
  { code: "INR", symbol: "₹" },
  { code: "NGN", symbol: "₦" },
  { code: "PKR", symbol: "₨" },
];

function getCurrencySymbol(code: string) {
  return CURRENCIES.find((c) => c.code === code)?.symbol || "£";
}

// ── Invoice Detail Modal ──────────────────────────────────────────────────────

interface InvoiceDetailModalProps {
  invoice: StudentInvoice;
  studentId: string;
  paymentMethods: PaymentMethod[];
  canMarkPaid: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

function InvoiceDetailModal({
  invoice,
  studentId,
  paymentMethods,
  canMarkPaid,
  onClose,
  onUpdated,
}: InvoiceDetailModalProps) {
  const [uploading, setUploading] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [markingPaid, setMarkingPaid] = useState(false);

  const sym = getCurrencySymbol(invoice.currency);

  const paymentMethodName = useMemo(() => {
    if (!invoice.paymentMethod) return null;
    return paymentMethods.find((m) => m.id === invoice.paymentMethod)?.name || invoice.paymentMethod;
  }, [invoice.paymentMethod, paymentMethods]);

  const handleMarkPaid = async () => {
    setMarkingPaid(true);
    try {
      let receiptUrl: string | null = null;
      let receiptFileName: string | null = null;

      if (receiptFile) {
        setUploading(true);
        const formData = new FormData();
        formData.append("files", receiptFile);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
        if (!uploadRes.ok) throw new Error("Failed to upload receipt");
        const uploadJson = await uploadRes.json();
        receiptUrl = uploadJson.urls?.[0] ?? null;
        receiptFileName = receiptFile.name;
        setUploading(false);
      }

      const res = await fetch(
        `/api/students/${studentId}/invoices/${invoice.id}/receipt`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            receiptUrl,
            receiptFileName,
            paidAt: new Date().toISOString(),
          }),
        }
      );

      if (!res.ok) throw new Error("Failed to mark invoice as paid");

      toast.success("Invoice marked as paid");
      onUpdated();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setMarkingPaid(false);
      setUploading(false);
    }
  };

  const lineItems: { label: string; amount: number }[] = [];
  if (invoice.fileOpeningCharge) lineItems.push({ label: "File Opening Charge", amount: invoice.fileOpeningCharge });
  if (invoice.serviceCharge && invoice.serviceChargeType === "FULL") lineItems.push({ label: "Service Charge (Full)", amount: invoice.serviceCharge });
  if (invoice.serviceInstalment1) lineItems.push({ label: invoice.serviceInstalment1Desc || "1st Instalment", amount: invoice.serviceInstalment1 });
  if (invoice.serviceInstalment2) lineItems.push({ label: invoice.serviceInstalment2Desc || "2nd Instalment", amount: invoice.serviceInstalment2 });
  if (invoice.ucasFee) lineItems.push({ label: "UCAS Application Fee", amount: invoice.ucasFee });
  if (invoice.applicationFee) lineItems.push({ label: invoice.applicationFeeDesc ? `Application Fee (${invoice.applicationFeeDesc})` : "Application Fee", amount: invoice.applicationFee });
  if (invoice.applicationFee2) lineItems.push({ label: invoice.applicationFee2Desc ? `Application Fee (${invoice.applicationFee2Desc})` : "Application Fee (Additional)", amount: invoice.applicationFee2 });
  if (invoice.airportPickupFee) lineItems.push({ label: invoice.airportPickupDesc ? `Airport Pickup (${invoice.airportPickupDesc})` : "Airport Pickup", amount: invoice.airportPickupFee });
  if (invoice.otherAmount) lineItems.push({ label: invoice.otherDescription || "Other Charges", amount: invoice.otherAmount });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="relative w-full max-w-lg rounded-xl bg-white shadow-xl overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <p className="font-mono text-lg font-bold text-slate-900">{invoice.invoiceNumber}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Raised by {invoice.createdByName} on {new Date(invoice.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                invoice.status === "PAID"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {invoice.status}
            </span>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Charges Breakdown */}
        <div className="px-6 py-4 space-y-1">
          {lineItems.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-slate-600">{item.label}</span>
              <span className="font-medium text-slate-900">
                {invoice.currency} {item.amount.toFixed(2)}
              </span>
            </div>
          ))}
          <div className="flex justify-between text-sm font-bold border-t border-slate-200 pt-2 mt-2">
            <span>Total</span>
            <span>
              {sym}{invoice.totalAmount.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Meta */}
        {(paymentMethodName || invoice.notes || invoice.paidAt) && (
          <div className="px-6 py-3 border-t border-slate-100 space-y-1 text-sm text-slate-600">
            {paymentMethodName && (
              <p><span className="font-medium">Payment Method:</span> {paymentMethodName}</p>
            )}
            {invoice.paidAt && (
              <p><span className="font-medium">Paid:</span> {new Date(invoice.paidAt).toLocaleDateString()}</p>
            )}
            {invoice.receiptFileName && (
              <p>
                <span className="font-medium">Receipt:</span>{" "}
                {invoice.receiptUrl ? (
                  <a href={invoice.receiptUrl} className="text-blue-600 underline" target="_blank" rel="noreferrer">
                    {invoice.receiptFileName}
                  </a>
                ) : (
                  invoice.receiptFileName
                )}
              </p>
            )}
            {invoice.notes && (
              <p><span className="font-medium">Notes:</span> {invoice.notes}</p>
            )}
          </div>
        )}

        {/* Mark as Paid (staff only, only if DUE) */}
        {canMarkPaid && invoice.status === "DUE" && (
          <div className="px-6 py-4 border-t border-slate-200 space-y-3">
            <p className="text-sm font-semibold text-slate-800">Mark as Paid</p>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">Attach receipt (optional)</span>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setReceiptFile(e.currentTarget.files?.[0] ?? null)}
                className="text-sm"
              />
            </label>
            {receiptFile && (
              <p className="text-xs text-slate-500">Selected: {receiptFile.name}</p>
            )}
            <button
              onClick={handleMarkPaid}
              disabled={markingPaid || uploading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              {markingPaid ? (uploading ? "Uploading..." : "Saving...") : "Mark as Paid"}
            </button>
          </div>
        )}

        {/* Close */}
        <div className="px-6 py-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function StudentPaymentsTab({
  studentId,
  currentUserRole,
}: StudentPaymentsTabProps) {
  const [currency, setCurrency] = useState("GBP");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<StudentInvoice | null>(null);

  // Form state
  const [fileOpeningCharge, setFileOpeningCharge] = useState(false);
  const [fileOpeningAmount, setFileOpeningAmount] = useState("");
  const [serviceCharge, setServiceCharge] = useState(false);
  const [serviceChargeType, setServiceChargeType] = useState("FULL");
  const [serviceAmount, setServiceAmount] = useState("");
  const [instalment1Desc, setInstalment1Desc] = useState("");
  const [instalment1Amount, setInstalment1Amount] = useState("");
  const [instalment2Desc, setInstalment2Desc] = useState("");
  const [instalment2Amount, setInstalment2Amount] = useState("");
  const [ucasFee, setUcasFee] = useState(false);
  const [ucasAmount, setUcasAmount] = useState("");
  const [appFee, setAppFee] = useState(false);
  const [appFeeDesc, setAppFeeDesc] = useState("");
  const [appFeeAmount, setAppFeeAmount] = useState("");
  const [appFee2, setAppFee2] = useState(false);
  const [appFee2Desc, setAppFee2Desc] = useState("");
  const [appFee2Amount, setAppFee2Amount] = useState("");
  const [airportPickup, setAirportPickup] = useState(false);
  const [airportPickupDesc, setAirportPickupDesc] = useState("");
  const [airportPickupAmount, setAirportPickupAmount] = useState("");
  const [otherCharge, setOtherCharge] = useState(false);
  const [otherDesc, setOtherDesc] = useState("");
  const [otherAmount, setOtherAmount] = useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("");
  const [notes, setNotes] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  const currencySymbol = useMemo(() => getCurrencySymbol(currency), [currency]);

  // Fetch invoices
  const {
    data: invoices = [],
    isLoading: invoicesLoading,
    refetch: refetchInvoices,
  } = useQuery({
    queryKey: ["student-invoices", studentId],
    queryFn: async () => {
      const res = await fetch(`/api/students/${studentId}/invoices`);
      if (!res.ok) throw new Error("Failed to fetch invoices");
      const json = await res.json();
      return json.data || [];
    },
  });

  // Fetch payment methods
  const { data: paymentMethods = [] } = useQuery<PaymentMethod[]>({
    queryKey: ["payment-methods"],
    queryFn: async () => {
      const res = await fetch("/api/admin/payment-methods");
      if (!res.ok) throw new Error("Failed to fetch payment methods");
      const json = await res.json();
      return json.data || [];
    },
  });

  // Calculate total
  const calculatedTotal = useMemo(() => {
    let total = 0;
    if (fileOpeningCharge) total += parseFloat(fileOpeningAmount) || 0;
    if (serviceCharge) {
      if (serviceChargeType === "FULL") {
        total += parseFloat(serviceAmount) || 0;
      } else {
        total += (parseFloat(instalment1Amount) || 0) + (parseFloat(instalment2Amount) || 0);
      }
    }
    if (ucasFee) total += parseFloat(ucasAmount) || 0;
    if (appFee) total += parseFloat(appFeeAmount) || 0;
    if (appFee2) total += parseFloat(appFee2Amount) || 0;
    if (airportPickup) total += parseFloat(airportPickupAmount) || 0;
    if (otherCharge) total += parseFloat(otherAmount) || 0;
    return Math.max(0, total);
  }, [
    fileOpeningCharge, fileOpeningAmount,
    serviceCharge, serviceChargeType, serviceAmount,
    instalment1Amount, instalment2Amount,
    ucasFee, ucasAmount,
    appFee, appFeeAmount,
    appFee2, appFee2Amount,
    airportPickup, airportPickupAmount,
    otherCharge, otherAmount,
  ]);

  const canCreateEditInvoices = [
    "ADMIN", "MANAGER", "COUNSELLOR", "SUB_AGENT", "BRANCH_MANAGER", "SUB_AGENT_COUNSELLOR",
  ].includes(currentUserRole);

  const canDeleteInvoices = [
    "ADMIN", "MANAGER", "SUB_AGENT", "BRANCH_MANAGER",
  ].includes(currentUserRole);

  const resetForm = () => {
    setFileOpeningCharge(false);
    setFileOpeningAmount("");
    setServiceCharge(false);
    setServiceChargeType("FULL");
    setServiceAmount("");
    setInstalment1Desc("");
    setInstalment1Amount("");
    setInstalment2Desc("");
    setInstalment2Amount("");
    setUcasFee(false);
    setUcasAmount("");
    setAppFee(false);
    setAppFeeDesc("");
    setAppFeeAmount("");
    setAppFee2(false);
    setAppFee2Desc("");
    setAppFee2Amount("");
    setAirportPickup(false);
    setAirportPickupDesc("");
    setAirportPickupAmount("");
    setOtherCharge(false);
    setOtherDesc("");
    setOtherAmount("");
    setSelectedPaymentMethod("");
    setNotes("");
    setEditingInvoiceId(null);
  };

  const prefillForm = (invoice: StudentInvoice) => {
    setCurrency(invoice.currency);

    setFileOpeningCharge(!!invoice.fileOpeningCharge);
    setFileOpeningAmount(invoice.fileOpeningCharge?.toString() ?? "");

    const hasService = !!(invoice.serviceCharge || invoice.serviceInstalment1 || invoice.serviceInstalment2);
    setServiceCharge(hasService);
    const type = invoice.serviceChargeType || "FULL";
    setServiceChargeType(type);
    setServiceAmount(invoice.serviceCharge?.toString() ?? "");
    setInstalment1Desc(invoice.serviceInstalment1Desc ?? "");
    setInstalment1Amount(invoice.serviceInstalment1?.toString() ?? "");
    setInstalment2Desc(invoice.serviceInstalment2Desc ?? "");
    setInstalment2Amount(invoice.serviceInstalment2?.toString() ?? "");

    setUcasFee(!!invoice.ucasFee);
    setUcasAmount(invoice.ucasFee?.toString() ?? "");

    setAppFee(!!invoice.applicationFee);
    setAppFeeDesc(invoice.applicationFeeDesc ?? "");
    setAppFeeAmount(invoice.applicationFee?.toString() ?? "");

    setAppFee2(!!invoice.applicationFee2);
    setAppFee2Desc(invoice.applicationFee2Desc ?? "");
    setAppFee2Amount(invoice.applicationFee2?.toString() ?? "");

    setAirportPickup(!!invoice.airportPickupFee);
    setAirportPickupDesc(invoice.airportPickupDesc ?? "");
    setAirportPickupAmount(invoice.airportPickupFee?.toString() ?? "");

    setOtherCharge(!!invoice.otherAmount);
    setOtherDesc(invoice.otherDescription ?? "");
    setOtherAmount(invoice.otherAmount?.toString() ?? "");

    setSelectedPaymentMethod(invoice.paymentMethod ?? "");
    setNotes(invoice.notes ?? "");
  };

  const handleRaiseInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (calculatedTotal <= 0) {
      toast.error("Please add at least one charge");
      return;
    }

    setFormLoading(true);
    try {
      const payload = {
        fileOpeningCharge: fileOpeningCharge ? parseFloat(fileOpeningAmount) : null,
        serviceCharge: serviceCharge && serviceChargeType === "FULL" ? parseFloat(serviceAmount) : null,
        serviceChargeType: serviceCharge ? serviceChargeType : null,
        serviceInstalment1: serviceCharge && serviceChargeType === "INSTALMENT" ? parseFloat(instalment1Amount) : null,
        serviceInstalment1Desc: serviceCharge && serviceChargeType === "INSTALMENT" ? instalment1Desc : null,
        serviceInstalment2: serviceCharge && serviceChargeType === "INSTALMENT" ? parseFloat(instalment2Amount) : null,
        serviceInstalment2Desc: serviceCharge && serviceChargeType === "INSTALMENT" ? instalment2Desc : null,
        ucasFee: ucasFee ? parseFloat(ucasAmount) : null,
        applicationFee: appFee ? parseFloat(appFeeAmount) : null,
        applicationFeeDesc: appFee ? appFeeDesc : null,
        applicationFee2: appFee2 ? parseFloat(appFee2Amount) : null,
        applicationFee2Desc: appFee2 ? appFee2Desc : null,
        airportPickupFee: airportPickup ? parseFloat(airportPickupAmount) : null,
        airportPickupDesc: airportPickup ? airportPickupDesc : null,
        otherDescription: otherCharge ? otherDesc : null,
        otherAmount: otherCharge ? parseFloat(otherAmount) : null,
        currency,
        paymentMethod: selectedPaymentMethod || null,
        notes: notes || null,
      };

      const url = editingInvoiceId
        ? `/api/students/${studentId}/invoices/${editingInvoiceId}`
        : `/api/students/${studentId}/invoices`;

      const res = await fetch(url, {
        method: editingInvoiceId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save invoice");

      toast.success(editingInvoiceId ? "Invoice updated" : "Invoice created");
      resetForm();
      setIsFormOpen(false);
      await refetchInvoices();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!confirm("Are you sure you want to delete this invoice?")) return;

    try {
      const res = await fetch(`/api/students/${studentId}/invoices/${invoiceId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete invoice");
      toast.success("Invoice deleted");
      await refetchInvoices();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "An error occurred");
    }
  };

  const isCashSelected =
    selectedPaymentMethod &&
    paymentMethods.find((m) => m.id === selectedPaymentMethod)?.type === "CASH";

  return (
    <div className="space-y-6">
      {/* Invoice Detail Modal */}
      {viewingInvoice && (
        <InvoiceDetailModal
          invoice={viewingInvoice}
          studentId={studentId}
          paymentMethods={paymentMethods}
          canMarkPaid={canCreateEditInvoices}
          onClose={() => setViewingInvoice(null)}
          onUpdated={refetchInvoices}
        />
      )}

      {/* Currency Selector */}
      {canCreateEditInvoices && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Invoice Currency
          </label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full sm:w-48 rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} {c.symbol}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Raise Invoice Form */}
      {canCreateEditInvoices && (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <button
            onClick={() => {
              if (isFormOpen) {
                setIsFormOpen(false);
                resetForm();
              } else {
                setIsFormOpen(true);
              }
            }}
            className="flex w-full items-center justify-between font-semibold text-slate-900"
          >
            <span>{editingInvoiceId ? "Edit Invoice" : "Raise New Invoice"}</span>
            <ChevronDown
              className={`w-5 h-5 transition-transform ${isFormOpen ? "rotate-180" : ""}`}
            />
          </button>

          {isFormOpen && (
            <form
              onSubmit={handleRaiseInvoice}
              className="mt-6 space-y-4 border-t border-slate-200 pt-6"
            >
              {/* File Opening Charge */}
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fileOpeningCharge}
                    onChange={(e) => setFileOpeningCharge(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm font-medium text-slate-700">File Opening Charge</span>
                </label>
                {fileOpeningCharge && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600">{currencySymbol}</span>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={fileOpeningAmount}
                      onChange={(e) => setFileOpeningAmount(e.target.value)}
                      className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>

              {/* Service Charge */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={serviceCharge}
                    onChange={(e) => setServiceCharge(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm font-medium text-slate-700">Service Charge</span>
                </label>
                {serviceCharge && (
                  <div className="ml-6 space-y-3">
                    <div className="flex gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="serviceType"
                          value="FULL"
                          checked={serviceChargeType === "FULL"}
                          onChange={(e) => setServiceChargeType(e.target.value)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-slate-600">Full Payment</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="serviceType"
                          value="INSTALMENT"
                          checked={serviceChargeType === "INSTALMENT"}
                          onChange={(e) => setServiceChargeType(e.target.value)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-slate-600">Instalment Payment</span>
                      </label>
                    </div>

                    {serviceChargeType === "FULL" ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-600">{currencySymbol}</span>
                        <input
                          type="number"
                          placeholder="0.00"
                          value={serviceAmount}
                          onChange={(e) => setServiceAmount(e.target.value)}
                          className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <input
                            type="text"
                            placeholder="1st Instalment Description"
                            value={instalment1Desc}
                            onChange={(e) => setInstalment1Desc(e.target.value)}
                            className="w-full mb-2 rounded-lg border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-600">{currencySymbol}</span>
                            <input
                              type="number"
                              placeholder="0.00"
                              value={instalment1Amount}
                              onChange={(e) => setInstalment1Amount(e.target.value)}
                              className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                        <div>
                          <input
                            type="text"
                            placeholder="2nd Instalment Description"
                            value={instalment2Desc}
                            onChange={(e) => setInstalment2Desc(e.target.value)}
                            className="w-full mb-2 rounded-lg border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-600">{currencySymbol}</span>
                            <input
                              type="number"
                              placeholder="0.00"
                              value={instalment2Amount}
                              onChange={(e) => setInstalment2Amount(e.target.value)}
                              className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* UCAS Fee */}
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ucasFee}
                    onChange={(e) => setUcasFee(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm font-medium text-slate-700">UCAS Application Fee</span>
                </label>
                {ucasFee && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600">{currencySymbol}</span>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={ucasAmount}
                      onChange={(e) => setUcasAmount(e.target.value)}
                      className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>

              {/* Application Fee */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={appFee}
                    onChange={(e) => setAppFee(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm font-medium text-slate-700">Application Fee</span>
                </label>
                {appFee && (
                  <div className="ml-6 space-y-2">
                    <input
                      type="text"
                      placeholder="Fee description"
                      value={appFeeDesc}
                      onChange={(e) => setAppFeeDesc(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-600">{currencySymbol}</span>
                      <input
                        type="number"
                        placeholder="0.00"
                        value={appFeeAmount}
                        onChange={(e) => setAppFeeAmount(e.target.value)}
                        className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Additional Application Fee */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={appFee2}
                    onChange={(e) => setAppFee2(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm font-medium text-slate-700">Application Fee (Additional)</span>
                </label>
                {appFee2 && (
                  <div className="ml-6 space-y-2">
                    <input
                      type="text"
                      placeholder="Fee description"
                      value={appFee2Desc}
                      onChange={(e) => setAppFee2Desc(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-600">{currencySymbol}</span>
                      <input
                        type="number"
                        placeholder="0.00"
                        value={appFee2Amount}
                        onChange={(e) => setAppFee2Amount(e.target.value)}
                        className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Airport Pickup */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={airportPickup}
                    onChange={(e) => setAirportPickup(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm font-medium text-slate-700">Airport Pickup</span>
                </label>
                {airportPickup && (
                  <div className="ml-6 space-y-2">
                    <input
                      type="text"
                      placeholder="Pickup description"
                      value={airportPickupDesc}
                      onChange={(e) => setAirportPickupDesc(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-600">{currencySymbol}</span>
                      <input
                        type="number"
                        placeholder="0.00"
                        value={airportPickupAmount}
                        onChange={(e) => setAirportPickupAmount(e.target.value)}
                        className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Other Charges */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={otherCharge}
                    onChange={(e) => setOtherCharge(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm font-medium text-slate-700">Other Charges</span>
                </label>
                {otherCharge && (
                  <div className="ml-6 space-y-2">
                    <input
                      type="text"
                      placeholder="Description"
                      value={otherDesc}
                      onChange={(e) => setOtherDesc(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-600">{currencySymbol}</span>
                      <input
                        type="number"
                        placeholder="0.00"
                        value={otherAmount}
                        onChange={(e) => setOtherAmount(e.target.value)}
                        className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Payment Method */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  Payment Method
                </label>
                <select
                  value={selectedPaymentMethod}
                  onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select payment method</option>
                  {paymentMethods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.name}
                    </option>
                  ))}
                </select>
                {isCashSelected && (
                  <div className="flex items-start gap-3 rounded-lg bg-amber-50 p-3 border border-amber-200">
                    <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-700">
                      Cash payment notification will be sent to Admin, Branch Manager and assigned Sub-Agent.
                    </p>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes"
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Total */}
              <div className="rounded-lg bg-slate-50 p-4 border border-slate-200">
                <div className="text-right">
                  <p className="text-sm text-slate-600 mb-1">Total</p>
                  <p className="text-3xl font-bold text-slate-900">
                    {currencySymbol}{calculatedTotal.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex gap-3 pt-4 border-t border-slate-200">
                <button
                  type="submit"
                  disabled={formLoading || calculatedTotal <= 0}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {formLoading
                    ? "Saving..."
                    : editingInvoiceId
                    ? "Save Changes"
                    : "Raise Invoice"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsFormOpen(false);
                    resetForm();
                  }}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Invoices List */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Invoices</h3>

        {invoicesLoading ? (
          <div className="text-center py-8 text-sm text-slate-500">Loading...</div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-8 text-sm text-slate-500">No invoices yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Invoice No</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Total</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice: StudentInvoice) => (
                  <tr
                    key={invoice.id}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 font-mono text-slate-900">
                      {invoice.invoiceNumber}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(invoice.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {invoice.currency} {invoice.totalAmount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                          invoice.status === "PAID"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => setViewingInvoice(invoice)}
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-slate-600 hover:bg-slate-100 text-xs"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                      {canCreateEditInvoices && invoice.status !== "PAID" && (
                        <button
                          onClick={() => {
                            prefillForm(invoice);
                            setEditingInvoiceId(invoice.id);
                            setIsFormOpen(true);
                          }}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-blue-600 hover:bg-blue-50 text-xs"
                        >
                          <Edit2 className="w-4 h-4" />
                          Edit
                        </button>
                      )}
                      {canDeleteInvoices && (
                        <button
                          onClick={() => handleDeleteInvoice(invoice.id)}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-red-600 hover:bg-red-50 text-xs"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
