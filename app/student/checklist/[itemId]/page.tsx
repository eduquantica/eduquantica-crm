"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import ChecklistStatusIcon from "@/components/ui/ChecklistStatusIcon";
import ChecklistUploadZone from "@/components/ui/ChecklistUploadZone";

type ItemData = {
  id: string;
  studentId: string;
  label: string;
  documentType: string;
  status: "PENDING" | "SCANNING" | "REVISION_REQUIRED" | "VERIFIED" | "REJECTED";
  reason: string | null;
  ocrStatus: string | null;
  ocrData: unknown;
  ocrConfidence: number | null;
  fileName: string | null;
  fileUrl: string | null;
  instructions: string;
  exampleImage: string;
};

type ItemResponse = { data: ItemData };

function extractOcrFields(ocrData: unknown): Record<string, string> {
  if (!ocrData || typeof ocrData !== "object") return {};
  const data = ocrData as Record<string, unknown>;

  if (typeof data.surname === "string" || typeof data.givenNames === "string") {
    return {
      Name: `${String(data.givenNames || "")} ${String(data.surname || "")}`.trim(),
      Expiry: String(data.expiryDate || "-"),
      "Document Number": String(data.documentNumber || "-"),
    };
  }

  if (typeof data.accountHolderName === "string") {
    return {
      "Account Holder": String(data.accountHolderName || "-"),
      "Statement Date": String(data.statementDate || "-"),
      "Closing Balance": String(data.closingBalance || "-"),
    };
  }

  if (typeof data.extractedText === "string") {
    return {
      "Extracted Text": data.extractedText.slice(0, 120) + (data.extractedText.length > 120 ? "..." : ""),
    };
  }

  return {};
}

export default function StudentChecklistItemPage() {
  const params = useParams<{ itemId: string }>();
  const itemId = params.itemId;

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [item, setItem] = useState<ItemData | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [corrections, setCorrections] = useState<Record<string, string>>({});

  const loadItem = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/student/checklist/${itemId}`, { cache: "no-store" });
      const json = (await res.json()) as ItemResponse | { error: string };
      if (!res.ok || !("data" in json)) {
        throw new Error("error" in json ? json.error : "Failed to load checklist item");
      }
      setItem(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load checklist item");
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    if (!itemId) return;
    void loadItem();
  }, [itemId, loadItem]);

  useEffect(() => {
    if (!item) return;
    if (item.status !== "SCANNING") return;

    const timer = setInterval(() => {
      void loadItem();
    }, 2500);

    return () => clearInterval(timer);
  }, [item, loadItem]);

  const detected = useMemo(() => extractOcrFields(item?.ocrData), [item?.ocrData]);

  async function uploadDocument(file: File) {
    setUploading(true);
    setError(null);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("files", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      const uploadJson = (await uploadRes.json()) as { urls?: string[]; error?: string; message?: string };

      if (!uploadRes.ok || !uploadJson.urls?.[0]) {
        throw new Error(uploadJson.error || "Upload failed");
      }

      const linkRes = await fetch(`/api/student/checklist/${itemId}/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileUrl: uploadJson.urls[0],
        }),
      });

      const linkJson = (await linkRes.json()) as { error?: string };
      if (!linkRes.ok) {
        throw new Error(linkJson.error || "Failed to attach document");
      }

      setMessage(uploadJson.message ? `Upload successful. ${uploadJson.message} OCR scanning has started.` : "Upload successful. OCR scanning has started.");
      await loadItem();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function submitFeedback(confirmed: boolean) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/student/checklist/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmed,
          corrections: confirmed ? {} : corrections,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to save feedback");
      setMessage(confirmed ? "Thanks. OCR details confirmed." : "Corrections submitted.");
      setShowEdit(false);
      await loadItem();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save feedback");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-slate-600">Loading checklist item...</div>;
  }

  if (error && !item) {
    return <div className="p-6 text-sm text-red-600">{error}</div>;
  }

  if (!item) {
    return <div className="p-6 text-sm text-slate-600">Checklist item not found.</div>;
  }

  return (
    <main className="mx-auto w-full max-w-4xl space-y-4 px-4 py-6 sm:px-6">
      <Link href="/student/documents" className="text-sm font-medium text-blue-700 hover:underline">← Back to documents</Link>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <ChecklistStatusIcon status={item.status} />
          <h1 className="text-xl font-bold text-slate-900">{item.label}</h1>
        </div>
        <p className="mt-3 text-sm text-slate-600">{item.instructions}</p>

        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <Image src={item.exampleImage} alt={`Example for ${item.label}`} width={1200} height={800} className="h-auto w-full" />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(item.documentType === "SOP" || item.documentType === "PERSONAL_STATEMENT") && (
            <Link
              href="/student/write-sop"
              className="rounded-lg border border-[#1B2A4A] bg-white px-4 py-2 text-sm font-semibold text-[#1B2A4A] hover:bg-slate-50"
            >
              Write Here
            </Link>
          )}
        </div>
      </section>

      {(item.status === "REVISION_REQUIRED" || item.status === "REJECTED") && item.reason && (
        <section className={`rounded-xl border p-4 ${item.status === "REJECTED" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}>
          <p className={`text-sm font-semibold ${item.status === "REJECTED" ? "text-red-800" : "text-amber-800"}`}>
            {item.status === "REJECTED" ? "Rejected" : "Revision Required"}
          </p>
          <p className={`mt-1 text-sm ${item.status === "REJECTED" ? "text-red-700" : "text-amber-700"}`}>{item.reason}</p>
          <button
            type="button"
            onClick={() => document.getElementById("upload-zone")?.scrollIntoView({ behavior: "smooth" })}
            className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Resubmit
          </button>
        </section>
      )}

      <section id="upload-zone" className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Upload</h2>
        <div className="mt-3">
          <ChecklistUploadZone
            onFileSelected={uploadDocument}
            uploading={uploading}
            checklistItemId={item.id}
            studentId={item.studentId}
            checklistItemName={item.label}
            onMobileUploadCompleted={() => {
              void loadItem();
            }}
          />
        </div>

        {item.status === "SCANNING" && (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
            OCR scanning is in progress. This page auto-refreshes every few seconds.
          </div>
        )}
      </section>

      {Object.keys(detected).length > 0 && item.status !== "SCANNING" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">OCR Feedback</h2>
          <p className="mt-1 text-sm text-slate-600">We detected the following. Is this correct?</p>

          <div className="mt-3 grid gap-2">
            {Object.entries(detected).map(([key, value]) => (
              <div key={key} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <span className="font-medium text-slate-700">{key}:</span> <span className="text-slate-900">{value || "-"}</span>
              </div>
            ))}
          </div>

          {!showEdit ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => void submitFeedback(true)}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                Yes - confirm
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  const initial: Record<string, string> = {};
                  Object.entries(detected).forEach(([key, value]) => {
                    initial[key] = value;
                  });
                  setCorrections(initial);
                  setShowEdit(true);
                }}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                No - edit values
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {Object.keys(corrections).map((key) => (
                <div key={key}>
                  <label className="mb-1 block text-xs font-medium text-slate-600">{key}</label>
                  <input
                    value={corrections[key] || ""}
                    onChange={(e) => setCorrections((prev) => ({ ...prev, [key]: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void submitFeedback(false)}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  Submit Corrections
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setShowEdit(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}
    </main>
  );
}
