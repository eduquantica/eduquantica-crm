"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

type FeePayload = {
  application: {
    id: string;
    studentId: string;
    status: string;
    isUcas: boolean;
  };
  university: {
    id: string;
    name: string;
  };
  course: {
    id: string;
    name: string;
  };
  fee: {
    feeRequired: boolean;
    displayStatus: "UNPAID" | "PENDING_APPROVAL" | "PAID" | "WAIVED" | "NOT_REQUIRED";
    amount: number;
    currency: string;
    feeType: "UCAS_SINGLE" | "UCAS_MULTIPLE" | "UNIVERSITY_DIRECT" | null;
    coveredByExisting: boolean;
    groupMessage: string | null;
  };
  bankDetails: {
    accountName: string;
    bankName: string;
    sortCode: string;
    accountNumber: string;
    iban: string;
    swift: string;
  };
  paymentReferenceSuggestion: string;
};

function money(amount: number, currency: string) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount || 0);
}

function statusBadge(status: FeePayload["fee"]["displayStatus"]) {
  if (status === "PAID") return "bg-emerald-100 text-emerald-700";
  if (status === "WAIVED") return "bg-blue-100 text-blue-700";
  if (status === "PENDING_APPROVAL") return "bg-amber-100 text-amber-700";
  if (status === "UNPAID") return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

export default function StudentApplicationFeePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [payload, setPayload] = useState<FeePayload | null>(null);
  const [paymentRef, setPaymentRef] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/student/applications/${params.id}/fee`, { cache: "no-store" });
        const json = await res.json() as { data?: FeePayload; error?: string };
        if (!res.ok || !json.data) throw new Error(json.error || "Failed to load fee details");
        if (!cancelled) {
          setPayload(json.data);
          setPaymentRef(json.data.paymentReferenceSuggestion);
        }
      } catch (error) {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "Failed to load fee details");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params.id]);

  async function uploadReceipt(file: File) {
    const formData = new FormData();
    formData.append("files", file);

    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    const json = await res.json() as { urls?: string[]; error?: string };
    if (!res.ok || !json.urls?.[0]) {
      throw new Error(json.error || "Failed to upload receipt");
    }

    setReceiptUrl(json.urls[0]);
    toast.success("Receipt uploaded");
  }

  async function submitPayment() {
    if (!payload?.fee.feeRequired) return;

    try {
      setSaving(true);
      const res = await fetch(`/api/student/applications/${params.id}/fee`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod: "BANK_TRANSFER",
          paymentRef,
          receiptUrl: receiptUrl || undefined,
        }),
      });
      const json = await res.json() as { data?: { fee?: FeePayload["fee"] }; error?: string };
      if (!res.ok || !json.data?.fee) throw new Error(json.error || "Failed to submit payment receipt");

      setPayload((prev) => (prev ? { ...prev, fee: json.data!.fee! } : prev));
      toast.success("Payment submitted and pending approval");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit payment receipt");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="mx-auto w-full max-w-5xl p-6 text-sm text-slate-600">Loading application fee details...</main>;
  }

  if (!payload) {
    return <main className="mx-auto w-full max-w-5xl p-6 text-sm text-rose-600">Failed to load application fee details.</main>;
  }

  const fromCreate = searchParams.get("fromCreate") === "1";

  return (
    <main className="mx-auto w-full max-w-5xl space-y-4 p-6">
      {fromCreate && payload.fee.feeRequired && (
        <section className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm text-blue-900">
            This application requires a fee of <span className="font-semibold">{money(payload.fee.amount, payload.fee.currency)}</span>.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => document.getElementById("fee-payment-form")?.scrollIntoView({ behavior: "smooth" })}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Pay Now
            </button>
            <button
              onClick={() => router.push(`/student/applications/${payload.application.id}`)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Pay Later
            </button>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Application Fee Payment</h1>
            <p className="mt-1 text-sm text-slate-600">{payload.university.name} • {payload.course.name}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadge(payload.fee.displayStatus)}`}>
            {payload.fee.displayStatus.replace("_", " ")}
          </span>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 p-4">
          <p className="text-sm text-slate-600">Fee amount</p>
          <p className="text-2xl font-bold text-slate-900">{money(payload.fee.amount, payload.fee.currency)}</p>
          <p className="mt-1 text-xs text-slate-500">
            Fee type: {payload.fee.feeType ? payload.fee.feeType.replaceAll("_", " ") : "Not required"}
          </p>
          {payload.application.isUcas && (
            <p className="mt-2 text-xs text-slate-600">
              This fee covers up to 5 UCAS applications.
              {payload.fee.groupMessage ? ` ${payload.fee.groupMessage}.` : ""}
            </p>
          )}
        </div>

        {payload.fee.feeRequired && payload.fee.displayStatus !== "PAID" && payload.fee.displayStatus !== "WAIVED" && (
          <div id="fee-payment-form" className="mt-4 space-y-4 rounded-lg border border-slate-200 p-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">Bank Transfer Details</p>
              <p className="mt-2 text-sm text-slate-700">Account Name: {payload.bankDetails.accountName}</p>
              <p className="text-sm text-slate-700">Bank: {payload.bankDetails.bankName}</p>
              <p className="text-sm text-slate-700">Sort Code: {payload.bankDetails.sortCode}</p>
              <p className="text-sm text-slate-700">Account Number: {payload.bankDetails.accountNumber}</p>
              <p className="text-sm text-slate-700">IBAN: {payload.bankDetails.iban}</p>
              <p className="text-sm text-slate-700">SWIFT: {payload.bankDetails.swift}</p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Payment reference</label>
              <input
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Student ID + Application ID"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Upload payment receipt</label>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadReceipt(file);
                }}
                className="w-full text-sm"
              />
              {receiptUrl && <p className="mt-1 text-xs text-emerald-700">Receipt uploaded successfully.</p>}
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={() => void submitPayment()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Submitting..." : "Mark as Paid"}
            </button>
          </div>
        )}

        <div className="mt-4">
          <Link
            href={`/student/applications/${payload.application.id}`}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back to Application
          </Link>
        </div>
      </section>
    </main>
  );
}
