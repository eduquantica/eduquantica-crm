"use client";

import { useEffect, useRef, useState } from "react";
import { Smartphone } from "lucide-react";
import QRCodeUploadModal from "@/components/shared/QRCodeUploadModal";

type Props = {
  onFileSelected: (file: File) => Promise<void> | void;
  uploading?: boolean;
  compact?: boolean;
  checklistItemId?: string;
  studentId?: string;
  checklistItemName?: string;
  documentField?: string;
  documentType?: string;
  onMobileUploadCompleted?: () => void;
};

export default function ChecklistUploadZone({
  onFileSelected,
  uploading = false,
  compact = false,
  checklistItemId,
  studentId,
  checklistItemName,
  documentField,
  documentType,
  onMobileUploadCompleted,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [hasActiveMobileSession, setHasActiveMobileSession] = useState(false);

  useEffect(() => {
    const activeStudentId = studentId || "";
    const activeDocumentField = checklistItemId || documentField || "";
    if (!activeStudentId || !activeDocumentField) return;

    let mounted = true;

    const refreshActive = async () => {
      try {
        const res = await fetch(
          `/api/mobile-upload/session/active?studentId=${encodeURIComponent(activeStudentId)}&documentField=${encodeURIComponent(activeDocumentField)}`,
          { cache: "no-store" },
        );
        const json = await res.json() as { hasActiveSession?: boolean };
        if (mounted) {
          setHasActiveMobileSession(Boolean(json.hasActiveSession));
        }
      } catch {
        if (mounted) {
          setHasActiveMobileSession(false);
        }
      }
    };

    void refreshActive();
    const interval = setInterval(() => {
      void refreshActive();
    }, 3000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [checklistItemId, documentField, studentId]);

  async function handleFile(file: File) {
    await onFileSelected(file);
  }

  const resolvedDocumentField = checklistItemId || documentField || "";
  const resolvedDocumentType = checklistItemId ? "CHECKLIST_ITEM" : (documentType || "");
  const canUseMobileUpload = Boolean(studentId && resolvedDocumentField && resolvedDocumentType);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) void handleFile(file);
      }}
      className={`rounded-xl border-2 border-dashed p-4 text-center transition ${dragOver ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50"}`}
    >
      <p className={`font-medium text-slate-800 ${compact ? "text-sm" : "text-base"}`}>
        Drag & drop your file here
      </p>
      <p className="mt-1 text-xs text-slate-500">PDF, JPG, JPEG, PNG, WEBP, HEIC supported. Images are auto-converted to PDF; files over 5MB are auto-compressed.</p>

      {hasActiveMobileSession && (
        <div className="mt-2 inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
          📱 Waiting for mobile upload...
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {uploading ? "Uploading..." : "Upload from Computer"}
        </button>

        <button
          type="button"
          onClick={() => setShowQrModal(true)}
          title="Scan QR code to upload from your phone"
          disabled={uploading || !canUseMobileUpload}
          className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
        >
          <Smartphone className="h-4 w-4" />
          📱 Take Photo with Phone via QR Code
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.currentTarget.value = "";
        }}
      />

      {canUseMobileUpload && studentId && (
        <QRCodeUploadModal
          open={showQrModal}
          studentId={studentId}
          documentField={resolvedDocumentField}
          documentType={resolvedDocumentType}
          documentLabel={checklistItemName}
          onClose={() => setShowQrModal(false)}
          onCompleted={async (payload) => {
            const uploaded = await fetch(payload.fileUrl);
            const blob = await uploaded.blob();
            const fallbackName = payload.fileName || `${resolvedDocumentField}.pdf`;
            const normalizedFile = new File([blob], fallbackName, {
              type: blob.type || "application/pdf",
            });

            await handleFile(normalizedFile);
            setHasActiveMobileSession(false);
            onMobileUploadCompleted?.();
          }}
        />
      )}
    </div>
  );
}
