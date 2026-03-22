"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { QRCode } from "react-qrcode-logo";
import AppModal from "@/components/ui/AppModal";

type Props = {
  open: boolean;
  checklistItemId: string;
  checklistItemName: string;
  studentId: string;
  onClose: () => void;
  onCompleted?: () => void;
};

type SessionStatus = "PENDING" | "UPLOADING" | "COMPLETED" | "EXPIRED";

export default function MobileUploadQR({
  open,
  checklistItemId,
  checklistItemName,
  studentId,
  onClose,
  onCompleted,
}: Props) {
  const [token, setToken] = useState<string | null>(null);
  const [expiresAtMs, setExpiresAtMs] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const qrUrl = useMemo(() => {
    if (!token || typeof window === "undefined") return "";
    return `${window.location.origin}/mobile-upload/${token}`;
  }, [token]);

  const progressPercent = useMemo(() => {
    const max = 30 * 60;
    if (secondsLeft <= 0) return 0;
    return Math.max(0, Math.min(100, (secondsLeft / max) * 100));
  }, [secondsLeft]);

  const formattedTimer = useMemo(() => {
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = secondsLeft % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, [secondsLeft]);

  const createSession = useCallback(async () => {
    if (!checklistItemId || !studentId) return;
    setLoading(true);
    setError(null);
    setToken(null);
    setSessionStatus(null);
    setUploadedFileName(null);
    setExpiresAtMs(null);

    try {
      const res = await fetch("/api/mobile-upload/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checklistItemId, studentId }),
      });
      const json = await res.json() as { token?: string; expiresAt?: string; error?: string };
      if (!res.ok || !json.token || !json.expiresAt) {
        throw new Error(json.error || "Failed to create session");
      }

      setToken(json.token);
      setSessionStatus("PENDING");
      setExpiresAtMs(new Date(json.expiresAt).getTime());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create session");
    } finally {
      setLoading(false);
    }
  }, [checklistItemId, studentId]);

  useEffect(() => {
    if (!open) return;
    void createSession();
  }, [open, createSession]);

  useEffect(() => {
    if (!open || !expiresAtMs) return;

    const interval = setInterval(() => {
      const next = Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000));
      setSecondsLeft(next);
      if (next === 0) {
        setSessionStatus((prev) => (prev === "COMPLETED" ? prev : "EXPIRED"));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [open, expiresAtMs]);

  useEffect(() => {
    if (!open || !token) return;
    if (sessionStatus === "COMPLETED" || sessionStatus === "EXPIRED") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/mobile-upload/session/${token}/status`, { cache: "no-store" });
        const json = await res.json() as {
          status?: SessionStatus;
          uploadedFileName?: string | null;
          error?: string;
        };

        if (!res.ok || !json.status) return;
        setSessionStatus(json.status);
        if (json.uploadedFileName) {
          setUploadedFileName(json.uploadedFileName);
        }
      } catch {
        // no-op during polling
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [open, token, sessionStatus]);

  useEffect(() => {
    if (sessionStatus !== "COMPLETED") return;
    onCompleted?.();
    const timer = setTimeout(() => {
      onClose();
    }, 2000);
    return () => clearTimeout(timer);
  }, [sessionStatus, onClose, onCompleted]);

  async function cancelSession() {
    if (token) {
      await fetch(`/api/mobile-upload/session/${token}`, { method: "DELETE" }).catch(() => undefined);
    }
    onClose();
  }

  if (!open) return null;

  return (
    <AppModal maxWidthClass="max-w-lg">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Upload from Phone</h3>
          <p className="mt-1 text-sm text-slate-600">Uploading for: {checklistItemName}</p>
        </div>

        {loading && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating QR code...
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && token && sessionStatus !== "COMPLETED" && sessionStatus !== "EXPIRED" && (
          <div className="space-y-4">
            <div className="flex justify-center rounded-lg border border-slate-200 bg-white p-4">
              <QRCode value={qrUrl} size={300} qrStyle="squares" eyeRadius={4} />
            </div>

            <div className="text-center text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Scan this QR code with your phone camera</p>
              <p>Open the link and select your document.</p>
              <p>It will appear here automatically.</p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Expires in:</span>
                <span className="font-semibold text-slate-900">{formattedTimer}</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div className="h-full bg-amber-500 transition-all" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
          </div>
        )}

        {sessionStatus === "COMPLETED" && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            </div>
            <p className="text-sm font-semibold text-emerald-800">Document uploaded successfully!</p>
            {uploadedFileName && <p className="mt-1 text-xs text-emerald-700">{uploadedFileName}</p>}
          </div>
        )}

        {sessionStatus === "EXPIRED" && (
          <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-800">QR code has expired.</p>
            <button
              type="button"
              onClick={() => void createSession()}
              className="inline-flex rounded-md bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700"
            >
              Generate New QR Code
            </button>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => void cancelSession()}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </AppModal>
  );
}
