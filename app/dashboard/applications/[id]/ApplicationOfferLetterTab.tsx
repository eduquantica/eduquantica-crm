"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import ChecklistUploadZone from "@/components/ui/ChecklistUploadZone";
import DocumentPreviewModal from "@/components/shared/DocumentPreviewModal";
import { toApiFilesPath, toApiFilesDownloadPath } from "@/lib/file-url";

type Props = {
  applicationId: string;
  studentId: string;
  onUploaded?: () => void;
};

type ExistingOfferLetter = {
  documentId: string;
  fileName: string;
  fileUrl: string;
};

export default function ApplicationOfferLetterTab({ applicationId, studentId, onUploaded }: Props) {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [existing, setExisting] = useState<ExistingOfferLetter | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ fileName: string; fileUrl: string } | null>(null);
  const [ocrInfo, setOcrInfo] = useState<{
    courseFee: number | null;
    scholarship: number | null;
    currency: string | null;
  } | null>(null);

  async function loadExisting() {
    try {
      const res = await fetch(`/api/dashboard/applications/${applicationId}/finance`, { cache: "no-store" });
      const json = await res.json() as { data?: { offerLetter?: ExistingOfferLetter | null } };
      if (res.ok && json.data?.offerLetter) {
        setExisting(json.data.offerLetter);
      } else {
        setExisting(null);
      }
    } catch {
      setExisting(null);
    }
  }

  useEffect(() => {
    void loadExisting();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("files", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      const uploadJson = (await uploadRes.json()) as { urls?: string[]; error?: string; message?: string };
      if (!uploadRes.ok || !uploadJson.urls?.[0]) {
        throw new Error(uploadJson.error || "Upload failed");
      }

      const res = await fetch(`/api/dashboard/applications/${applicationId}/finance/offer-letter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileUrl: uploadJson.urls[0],
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save offer letter");

      setOcrInfo(json.data?.ocr || null);
      if (json.data?.autoExtracted) {
        toast.success("Offer letter scanned. Figures pre-filled. Please verify before proceeding.");
      } else {
        toast.info("Could not extract automatically. Please enter figures manually.");
      }
      if (uploadJson.message) {
        toast.success(uploadJson.message);
      }
      await loadExisting();
      onUploaded?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload offer letter");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    if (!existing?.documentId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/documents/${existing.documentId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to delete offer letter");
      toast.success("Offer letter deleted.");
      setExisting(null);
      setOcrInfo(null);
      onUploaded?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete offer letter");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
      <h3 className="text-lg font-semibold text-gray-900">Offer Letter</h3>

      {existing ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-emerald-700">✓ Uploaded:</span>
            <span className="text-emerald-900 truncate max-w-xs">{existing.fileName}</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPreviewDoc({ fileName: existing.fileName, fileUrl: toApiFilesPath(existing.fileUrl) })}
              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Preview
            </button>
            <a
              href={toApiFilesDownloadPath(existing.fileUrl)}
              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Download
            </a>
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={deleting}
              className="rounded border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60"
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
          <p className="mt-3 text-xs text-emerald-700">To replace the offer letter, delete this one and upload a new file.</p>
        </div>
      ) : (
        <ChecklistUploadZone
          onFileSelected={handleUpload}
          uploading={uploading}
          studentId={studentId}
          checklistItemName="Offer Letter"
          documentField={`finance:offer-letter:${applicationId}`}
          documentType="OTHER"
        />
      )}

      {ocrInfo && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <p className="font-semibold">Offer Letter OCR Preview</p>
          <p>Course Fee: {ocrInfo.courseFee ?? "-"} {ocrInfo.currency || ""}</p>
          <p>Scholarship: {ocrInfo.scholarship ?? "-"} {ocrInfo.currency || ""}</p>
        </div>
      )}

      {previewDoc && (
        <DocumentPreviewModal
          fileUrl={previewDoc.fileUrl}
          fileName={previewDoc.fileName}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </div>
  );
}
