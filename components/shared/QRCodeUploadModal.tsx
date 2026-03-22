"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { CheckCircle2, Loader2, Smartphone } from "lucide-react";
import AppModal from "@/components/ui/AppModal";

type SessionStatus = "PENDING" | "UPLOADING" | "COMPLETED" | "EXPIRED";

type Props = {
  open: boolean;
  studentId: string;
  documentField: string;
  documentType: string;
  documentLabel?: string;
  onClose: () => void;
  onCompleted?: (payload: { fileUrl: string; fileName: string }) => void;
};

export default function QRCodeUploadModal({
  open,
  studentId,
  documentField,
  documentType,
  documentLabel,
  onClose,
  onCompleted,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<SessionStatus | null>(null);
  const [expiresAtMs, setExpiresAtMs] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [qrUrl, setQrUrl] = useState<string>("");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  const formattedTimer = useMemo(() => {
    const mins = Math.floor(secondsLeft / 60);
    const secs = secondsLeft % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }, [secondsLeft]);

  const createSession = useCallback(async () => {
    if (!studentId || !documentField || !documentType) return;

    setLoading(true);
    setError(null);
    setToken(null);
    setStatus(null);
    setQrDataUrl("");
    setQrUrl("");
    setExpiresAtMs(null);

    try {
      const res = await fetch("/api/mobile-upload/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, documentField, documentType }),
      });

      const json = await res.json() as { token?: string; expiresAt?: string; qrUrl?: string; error?: string };
      if (!res.ok || !json.token || !json.expiresAt || !json.qrUrl) {
        throw new Error(json.error || "Failed to create QR upload session");
      }

      setToken(json.token);
      setStatus("PENDING");
      setQrUrl(json.qrUrl);
      setExpiresAtMs(new Date(json.expiresAt).getTime());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create QR session");
    } finally {
      setLoading(false);
    }
  }, [studentId, documentField, documentType]);

  useEffect(() => {
    if (!open) return;
    void createSession();
  }, [open, createSession]);

  useEffect(() => {
    if (!qrUrl) return;
    let mounted = true;

    void QRCode.toDataURL(qrUrl, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 320,
    }).then((url) => {
      if (mounted) setQrDataUrl(url);
    }).catch(() => {
      if (mounted) setError("Failed to generate QR code");
    });

    return () => {
      mounted = false;
    };
  }, [qrUrl]);

  useEffect(() => {
    if (!open || !expiresAtMs) return;
    const timer = setInterval(() => {
      const next = Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000));
      setSecondsLeft(next);
      if (next === 0) {
        setStatus((prev) => (prev === "COMPLETED" ? prev : "EXPIRED"));
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [open, expiresAtMs]);

  useEffect(() => {
    if (!open || !token) return;
    if (status === "COMPLETED" || status === "EXPIRED") return;

    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/mobile-upload/${token}`, { cache: "no-store" });
        const json = await res.json() as {
          status?: SessionStatus;
          uploadedFileUrl?: string | null;
          uploadedFileName?: string | null;
        };

        if (!json.status) return;
        setStatus(json.status);

        if (json.status === "COMPLETED" && json.uploadedFileUrl && json.uploadedFileName) {
          onCompleted?.({ fileUrl: json.uploadedFileUrl, fileName: json.uploadedFileName });
          setTimeout(() => onClose(), 1500);
        }
      } catch {
        // no-op while polling
      }
    }, 2000);

    return () => clearInterval(poll);
  }, [open, token, status, onClose, onCompleted]);

  if (!open) return null;

  return (
    <AppModal maxWidthClass="max-w-lg">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Take Photo with Phone via QR Code</h3>
          <p className="mt-1 text-sm text-slate-600">{documentLabel ? `Uploading for: ${documentLabel}` : "Upload from your mobile camera."}</p>
        </div>

        {loading && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating secure QR code...
            </div>
          </div>
        )}

        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        {!loading && !error && status !== "COMPLETED" && status !== "EXPIRED" && (
          <div className="space-y-4">
            <div className="flex justify-center rounded-lg border border-slate-200 bg-white p-4">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt="Mobile upload QR" className="h-[280px] w-[280px]" />
              ) : (
                <div className="flex h-[280px] w-[280px] items-center justify-center text-sm text-slate-500">Preparing QR...</div>
              )}
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">How it works</p>
              <p className="mt-1">1. Open your phone camera and scan the code.</p>
              <p>2. Take a clear photo of your document.</p>
              <p>3. Upload from your phone. This screen updates automatically.</p>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              <span className="inline-flex items-center gap-1 text-slate-600"><Smartphone className="h-4 w-4" /> Expires in</span>
              <span className="font-semibold text-slate-900">{formattedTimer}</span>
            </div>
          </div>
        )}

        {status === "COMPLETED" && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center text-sm text-emerald-800">
            <CheckCircle2 className="mx-auto mb-2 h-8 w-8" />
            Upload received successfully.
          </div>
        )}

        {status === "EXPIRED" && (
          <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <p className="font-semibold">QR code expired. Generate a new one to continue.</p>
            <button
              type="button"
              onClick={() => void createSession()}
              className="rounded-md bg-amber-600 px-3 py-2 font-semibold text-white hover:bg-amber-700"
            >
              Generate New QR Code
            </button>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </AppModal>
  );
}
