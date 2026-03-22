"use client";

import { useState } from "react";
import { toast } from "sonner";
import ChecklistUploadZone from "@/components/ui/ChecklistUploadZone";

type Props = {
  applicationId: string;
  studentId: string;
  onUploaded?: () => void;
};

export default function ApplicationOfferLetterTab({ applicationId, studentId, onUploaded }: Props) {
  const [uploading, setUploading] = useState(false);
  const [ocrInfo, setOcrInfo] = useState<{
    courseFee: number | null;
    scholarship: number | null;
    currency: string | null;
  } | null>(null);

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
      toast.success(uploadJson.message ? `Offer letter uploaded. ${uploadJson.message}` : "Offer letter uploaded and OCR extracted.");
      onUploaded?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload offer letter");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
      <h3 className="text-lg font-semibold text-gray-900">Upload Offer Letter</h3>
      <ChecklistUploadZone
        onFileSelected={handleUpload}
        uploading={uploading}
        studentId={studentId}
        checklistItemName="Offer Letter"
        documentField={`finance:offer-letter:${applicationId}`}
        documentType="OTHER"
      />

      {ocrInfo && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <p className="font-semibold">Offer Letter OCR Preview</p>
          <p>Course Fee: {ocrInfo.courseFee ?? "-"} {ocrInfo.currency || ""}</p>
          <p>Scholarship: {ocrInfo.scholarship ?? "-"} {ocrInfo.currency || ""}</p>
        </div>
      )}
    </div>
  );
}
