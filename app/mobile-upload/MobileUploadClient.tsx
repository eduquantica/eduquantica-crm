"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Camera, CheckCircle2, Image as ImageIcon, TriangleAlert } from "lucide-react";

type SessionStatus = "PENDING" | "UPLOADING" | "COMPLETED" | "EXPIRED";

type SessionPayload = {
  valid?: boolean;
  status?: SessionStatus;
  documentField?: string | null;
  documentType?: string | null;
  uploadedFileName?: string | null;
};

type ViewState = "loading" | "expired" | "already_used" | "active" | "uploading" | "success" | "error";

export default function MobileUploadClient({ token }: { token: string }) {
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null);
  const [sessionInfo, setSessionInfo] = useState<SessionPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  const imagePreview = useMemo(() => {
    if (!selectedFile || !selectedFile.type.startsWith("image/")) return null;
    return URL.createObjectURL(selectedFile);
  }, [selectedFile]);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  useEffect(() => {
    if (!token) {
      setError("Missing upload token");
      setViewState("error");
      return;
    }

    const loadSession = async () => {
      setViewState("loading");
      setError(null);
      try {
        const res = await fetch(`/api/mobile-upload/${token}`, { cache: "no-store" });
        const json = await res.json() as SessionPayload | { error?: string };

        if (res.status === 410) {
          setSessionStatus("EXPIRED");
          setViewState("expired");
          return;
        }

        if (!res.ok || !("status" in json) || !json.status) {
          throw new Error(("error" in json && json.error) || "Failed to fetch upload session");
        }

        setSessionStatus(json.status);
        setSessionInfo(json);

        if (json.status === "COMPLETED") {
          setUploadedFileName(json.uploadedFileName || null);
          setViewState("already_used");
          return;
        }

        if (json.status === "EXPIRED") {
          setViewState("expired");
          return;
        }

        setViewState("active");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load upload session");
        setViewState("error");
      }
    };

    void loadSession();
  }, [token]);

  async function handleUpload() {
    if (!token || !selectedFile) return;

    setViewState("uploading");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fetch(`/api/mobile-upload/${token}`, {
        method: "POST",
        body: formData,
      });

      const json = await res.json() as {
        success?: boolean;
        reason?: string;
        fileName?: string;
      };

      if (res.status === 410 || json.reason === "expired") {
        setViewState("expired");
        return;
      }

      if (res.status === 409 || json.reason === "already_used") {
        setViewState("already_used");
        return;
      }

      if (!res.ok || !json.success) {
        throw new Error("Upload failed. Please try again.");
      }

      setSessionStatus("COMPLETED");
      setUploadedFileName(json.fileName || selectedFile.name);
      setViewState("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setViewState("error");
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md px-4 py-6">
      <header className="mb-5 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1B2A4A] text-sm font-bold text-white">EQ</div>
          <div>
            <p className="text-base font-semibold text-slate-900">EduQuantica</p>
            <p className="text-base text-slate-700">Mobile Document Upload</p>
          </div>
        </div>
      </header>

      {viewState === "loading" && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 text-base text-slate-700">
          Fetching your upload session...
        </section>
      )}

      {viewState === "expired" && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-center">
          <TriangleAlert className="mx-auto mb-2 h-10 w-10 text-amber-600" />
          <h1 className="text-lg font-semibold text-amber-900">This upload link has expired.</h1>
          <p className="mt-2 text-base text-amber-800">
            QR codes are valid for 10 minutes only. Please generate a new QR code from your portal.
          </p>
        </section>
      )}

      {viewState === "already_used" && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 text-center">
          <CheckCircle2 className="mx-auto mb-2 h-10 w-10 text-emerald-600" />
          <h1 className="text-lg font-semibold text-slate-900">This QR session is already used.</h1>
          <p className="mt-2 text-base text-slate-700">Please generate a new QR code if you need to upload another file.</p>
          {uploadedFileName && <p className="mt-2 text-sm text-slate-500">Uploaded: {uploadedFileName}</p>}
        </section>
      )}

      {(viewState === "active" || viewState === "uploading" || viewState === "success" || viewState === "error") && (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <h1 className="text-lg font-semibold text-slate-900">Upload document</h1>
          {sessionInfo?.documentType && (
            <p className="text-sm text-slate-600">Type: {sessionInfo.documentType}</p>
          )}

          {(viewState === "active" || viewState === "error") && (
            <>
              <div className="grid grid-cols-1 gap-3">
                <label className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-800">
                  <Camera className="h-5 w-5" />
                  Tap to take a photo
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*,application/pdf"
                    capture="environment"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  />
                </label>

                <label className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-800">
                  <ImageIcon className="h-5 w-5" />
                  Choose from gallery
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*,application/pdf"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  />
                </label>
              </div>

              {selectedFile && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-base font-medium text-slate-900">{selectedFile.name}</p>
                  <p className="text-base text-slate-600">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  {imagePreview && (
                    <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
                      <Image src={imagePreview} alt="Preview" width={800} height={800} className="h-auto w-full" unoptimized />
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => void handleUpload()}
                disabled={!selectedFile}
                className="min-h-12 w-full rounded-lg bg-amber-500 px-4 py-3 text-base font-semibold text-slate-900 disabled:opacity-50"
              >
                Upload Document
              </button>
            </>
          )}

          {viewState === "uploading" && (
            <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="text-base font-medium text-blue-800">Uploading your document...</p>
              <p className="text-base text-blue-700">Please keep this page open</p>
            </div>
          )}

          {viewState === "success" && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center">
              <CheckCircle2 className="mx-auto mb-2 h-12 w-12 text-emerald-600" />
              <p className="text-lg font-semibold text-emerald-800">Document uploaded successfully!</p>
              <p className="mt-1 text-base text-emerald-700">{uploadedFileName || "Document"} has been sent to your portal session.</p>
            </div>
          )}

          {viewState === "error" && error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-base text-red-700">
              {error}
            </div>
          )}

          {sessionStatus && (
            <p className="text-xs text-slate-500">Session status: {sessionStatus}</p>
          )}
        </section>
      )}
    </main>
  );
}
