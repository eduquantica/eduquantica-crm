"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import ChecklistUploadZone from "@/components/ui/ChecklistUploadZone";
import DocumentPreviewModal from "@/components/shared/DocumentPreviewModal";
import { toApiFilesDownloadPath } from "@/lib/file-url";

type DeleteTarget = {
  sourceType: "DOCUMENT" | "TEST_SCORE" | "WRITTEN_DOCUMENT";
  sourceId: string;
};

type UploadedDocument = {
  id: string;
  documentName: string;
  documentType: string;
  fileUrl: string;
  uploadedAt: string;
  fileSize: number | null;
  status: "PENDING" | "SCANNING" | "VERIFIED" | "REVISION_REQUIRED" | "REJECTED";
  source: string;
  deleteTarget: DeleteTarget | null;
};

type RequiredChecklistItem = {
  id: string;
  requestId: string | null;
  qualificationId: string | null;
  label: string;
  documentType: string;
  itemKind: string;
  status: "TODO" | "UPLOADED" | "VERIFIED" | "NEEDS_REVISION";
  hasFile: boolean;
  fileUrl: string | null;
  fileName: string | null;
  uploadedAt: string | null;
  requestedByName: string | null;
  requestedByRole: string | null;
  staffNote: string | null;
  deleteTarget: DeleteTarget | null;
};

type DocumentsResponse = {
  data: {
    studentId: string;
    studentName: string;
    passportFileUrl: string | null;
    verifiedCount: number;
    totalRequired: number;
    pendingReviewCount: number;
    needsRevisionCount: number;
    stillRequiredCount: number;
    readyBanner: "AWAITING_VERIFICATION" | "READY_TO_APPLY" | null;
    uploadedDocuments: UploadedDocument[];
    requiredChecklist: RequiredChecklistItem[];
    qualifications: Array<{
      id: string;
      qualType: string;
      qualName: string;
      transcriptFileUrl: string | null;
      certificateFileUrl: string | null;
    }>;
    testScores: Array<{
      id: string;
      testType: string;
      certificateUrl: string | null;
    }>;
    documentRequests: Array<{
      id: string;
      documentType: string;
      documentLabel: string;
      customLabel: string | null;
      uploadedFileUrl: string | null;
      verificationStatus: string;
    }>;
  };
};

function formatBytes(size: number | null) {
  if (size == null) return "-";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function statusBadgeClass(status: UploadedDocument["status"] | RequiredChecklistItem["status"]) {
  if (status === "VERIFIED") return "bg-emerald-100 text-emerald-700";
  if (status === "SCANNING") return "bg-blue-100 text-blue-700";
  if (status === "UPLOADED") return "bg-blue-100 text-blue-700";
  if (status === "REVISION_REQUIRED") return "bg-amber-100 text-amber-700";
  if (status === "NEEDS_REVISION") return "bg-amber-100 text-amber-700";
  if (status === "REJECTED") return "bg-red-100 text-red-700";
  if (status === "TODO") return "bg-slate-100 text-slate-700";
  return "bg-slate-100 text-slate-700";
}

function statusLabel(status: UploadedDocument["status"] | RequiredChecklistItem["status"]) {
  if (status === "TODO") return "To Do";
  if (status === "UPLOADED" || status === "PENDING" || status === "SCANNING") return "Uploaded";
  if (status === "VERIFIED") return "Verified";
  if (status === "NEEDS_REVISION" || status === "REVISION_REQUIRED" || status === "REJECTED") return "Needs Revision";
  return String(status).replaceAll("_", " ");
}

function detectVaultSuggestion(fileName: string) {
  const value = fileName.toLowerCase();
  if (value.includes("passport")) return "This looks like a Passport. Link it to your Passport section?";
  if (value.includes("transcript")) return "This looks like a transcript. Which qualification is this for?";
  if (value.includes("certificate")) return "This looks like a certificate. Link it to the matching checklist item?";
  if (value.includes("ielts") || value.includes("toefl") || value.includes("pte") || value.includes("duolingo") || value.includes("oet")) {
    return "This looks like a test certificate. Link it to your Test Scores section?";
  }
  return "Document uploaded. You can link it to a checklist item from this page.";
}

function buildPassportDownloadName(studentName: string) {
  const normalized = studentName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "student";
  return `passport-${normalized}.pdf`;
}

function ChecklistStateIcon({ status }: { status: RequiredChecklistItem["status"] }) {
  if (status === "VERIFIED") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
        <Check className="h-4 w-4" />
      </span>
    );
  }
  if (status === "UPLOADED" || status === "NEEDS_REVISION") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-blue-500 bg-blue-50 text-blue-600">
        <Check className="h-4 w-4" />
      </span>
    );
  }
  return <span className="block h-6 w-6 rounded-full border-2 border-slate-300 bg-white" />;
}

export default function StudentDocumentsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [verifiedCount, setVerifiedCount] = useState(0);
  const [totalRequired, setTotalRequired] = useState(0);
  const [pendingReviewCount, setPendingReviewCount] = useState(0);
  const [needsRevisionCount, setNeedsRevisionCount] = useState(0);
  const [stillRequiredCount, setStillRequiredCount] = useState(0);
  const [readyBanner, setReadyBanner] = useState<"AWAITING_VERIFICATION" | "READY_TO_APPLY" | null>(null);
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);
  const [requiredChecklist, setRequiredChecklist] = useState<RequiredChecklistItem[]>([]);
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const [deletingTarget, setDeletingTarget] = useState<string | null>(null);
  const [vaultUploading, setVaultUploading] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{ name: string; url: string } | null>(null);
  const [studentId, setStudentId] = useState<string>("");
  const [studentName, setStudentName] = useState<string>("student");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/student/documents", { cache: "no-store" });
      const json = (await res.json()) as DocumentsResponse | { error?: string };
      if (!res.ok || !("data" in json)) {
        throw new Error(("error" in json && json.error) || "Failed to load documents");
      }

      setVerifiedCount(json.data.verifiedCount || 0);
      setStudentId(json.data.studentId || "");
      setStudentName(json.data.studentName || "student");
      setTotalRequired(json.data.totalRequired || 0);
      setPendingReviewCount(json.data.pendingReviewCount || 0);
      setNeedsRevisionCount(json.data.needsRevisionCount || 0);
      setStillRequiredCount(json.data.stillRequiredCount || 0);
      setReadyBanner(json.data.readyBanner || null);
      setUploadedDocuments(json.data.uploadedDocuments || []);
      setRequiredChecklist(json.data.requiredChecklist || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const completionPct = useMemo(() => {
    if (!totalRequired) return 0;
    return Math.round((verifiedCount / totalRequired) * 100);
  }, [verifiedCount, totalRequired]);

  async function deleteUpload(target: DeleteTarget, confirmationMessage = "Are you sure you want to delete this file?") {
    const confirmed = window.confirm(confirmationMessage);
    if (!confirmed) return;

    const targetKey = `${target.sourceType}:${target.sourceId}`;
    setDeletingTarget(targetKey);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/student/documents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(target),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error || "Failed to delete document");
      }

      setMessage("Document deleted successfully.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete document");
    } finally {
      setDeletingTarget(null);
    }
  }

  async function uploadRequiredItem(item: RequiredChecklistItem, file: File) {
    setUploadingItemId(item.id);
    setError(null);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append("files", file);
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const uploadJson = (await uploadRes.json()) as { urls?: string[]; error?: string; message?: string };
      if (!uploadRes.ok || !uploadJson.urls?.[0]) {
        throw new Error(uploadJson.error || "Upload failed");
      }

      const linkRes = item.requestId
        ? await fetch(`/api/student/document-requests/${item.requestId}/upload`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileName: file.name,
              fileUrl: uploadJson.urls[0],
            }),
          })
        : await fetch("/api/student/documents/smart-upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              itemLabel: item.label,
              itemKind: item.itemKind,
              qualificationId: item.qualificationId || undefined,
              fileName: file.name,
              fileUrl: uploadJson.urls[0],
            }),
          });
      const linkJson = (await linkRes.json()) as { error?: string };
      if (!linkRes.ok) {
        throw new Error(linkJson.error || "Failed to attach file");
      }

      setMessage(uploadJson.message ? `Upload successful. ${uploadJson.message}` : "Upload successful.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload file");
    } finally {
      setUploadingItemId(null);
    }
  }

  async function uploadToVault(file: File) {
    setVaultUploading(true);
    setError(null);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("files", file);
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const uploadJson = (await uploadRes.json()) as { urls?: string[]; error?: string; message?: string };
      if (!uploadRes.ok || !uploadJson.urls?.[0]) {
        throw new Error(uploadJson.error || "Upload failed");
      }

      const saveRes = await fetch("/api/student/documents/smart-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemLabel: file.name,
          itemKind: "SMART_DOCUMENT_VAULT",
          fileName: file.name,
          fileUrl: uploadJson.urls[0],
        }),
      });

      const saveJson = (await saveRes.json()) as { error?: string };
      if (!saveRes.ok) {
        throw new Error(saveJson.error || "Failed to save smart vault upload");
      }

      setMessage(detectVaultSuggestion(file.name));
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload file");
    } finally {
      setVaultUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <div className="glass-card p-8 text-sm text-slate-600 dark:text-slate-300">Loading documents...</div>
      </div>
    );
  }

  return (
    <main className="w-full max-w-[1400px] space-y-6 px-5 py-6 sm:px-7">
      <section className="glass-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-[#1B2A4A]">📁 My Documents</h1>
            <p className="mt-1 text-sm text-slate-500">Smart checklist built from your profile, test scores, uploads, and staff requests.</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative h-24 w-24">
              <svg viewBox="0 0 100 100" className="h-24 w-24 -rotate-90">
                <circle cx="50" cy="50" r="42" className="fill-none stroke-slate-200" strokeWidth="10" />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  className="fill-none stroke-emerald-500"
                  strokeWidth="10"
                  strokeDasharray={`${completionPct * 2.64} 264`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-lg font-semibold text-slate-900">{verifiedCount}/{totalRequired}</span>
                <span className="text-xs text-slate-500">verified</span>
              </div>
            </div>
            <div className="text-sm text-slate-600">
              <p>
                Verified: <span className="font-semibold text-slate-900">{verifiedCount}</span>
              </p>
              <p>
                Total Required: <span className="font-semibold text-slate-900">{totalRequired}</span>
              </p>
              <p>
                Uploaded: <span className="font-semibold text-blue-700">{pendingReviewCount}</span>
              </p>
              <p>
                Needs Revision: <span className="font-semibold text-amber-700">{needsRevisionCount}</span>
              </p>
              <p>
                To Do: <span className="font-semibold text-red-700">{stillRequiredCount}</span>
              </p>
            </div>
          </div>
        </div>

        {readyBanner === "AWAITING_VERIFICATION" && (
          <div className="mt-4 rounded-lg border border-blue-200/80 bg-blue-50/90 dark:border-blue-400/30 dark:bg-blue-900/30 p-3 text-sm text-blue-700 dark:text-blue-300">
            All required files are uploaded and waiting for staff verification.
          </div>
        )}
        {readyBanner === "READY_TO_APPLY" && (
          <div className="mt-4 rounded-lg border border-emerald-200/80 bg-emerald-50/90 dark:border-emerald-400/30 dark:bg-emerald-900/30 p-3 text-sm text-emerald-700 dark:text-emerald-300">
            File ready to apply. All checklist items are verified.
          </div>
        )}

        {error && <div className="mt-4 rounded-lg border border-red-200/80 bg-red-50/90 dark:border-red-400/30 dark:bg-red-900/30 p-3 text-sm text-red-700 dark:text-red-300">{error}</div>}
        {message && <div className="mt-4 rounded-lg border border-emerald-200/80 bg-emerald-50/90 dark:border-emerald-400/30 dark:bg-emerald-900/30 p-3 text-sm text-emerald-700 dark:text-emerald-300">{message}</div>}
      </section>

      <section className="glass-card p-6">
        <h2 className="text-lg font-semibold text-slate-900">Smart Checklist</h2>
        <div className="mt-4 space-y-3">
          {requiredChecklist.map((item) => {
            const itemUrl = item.fileUrl ?? "";
            const targetKey = item.deleteTarget ? `${item.deleteTarget.sourceType}:${item.deleteTarget.sourceId}` : null;
            const isPassportItem = item.documentType === "PASSPORT";
            const badgeClass = isPassportItem
              ? item.fileUrl
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-700"
              : statusBadgeClass(item.status);
            const badgeLabel = isPassportItem
              ? item.fileUrl
                ? "Uploaded"
                : "Upload Required"
              : statusLabel(item.status);
            const passportDownloadName = buildPassportDownloadName(studentName);
            return (
              <article key={item.id} className="rounded-xl border border-white/40 bg-white/50 dark:border-white/10 dark:bg-white/5 p-4 backdrop-blur-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <ChecklistStateIcon status={item.status} />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                      <p className="text-xs text-slate-500">{item.documentType.replaceAll("_", " ")}</p>
                      {item.requestedByName && (
                        <p className="text-xs text-slate-500">Requested by {item.requestedByName} ({item.requestedByRole || "STAFF"})</p>
                      )}
                      {item.staffNote && <p className="text-xs italic text-slate-500">{item.staffNote}</p>}
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass}`}>{badgeLabel}</span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {item.fileUrl ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          if (isPassportItem) {
                            window.open(toApiFilesDownloadPath(itemUrl), "_blank", "noopener,noreferrer");
                            return;
                          }
                          setPreviewDoc({ name: item.fileName || item.label, url: itemUrl });
                        }}
                        className="rounded border border-slate-300 dark:border-white/20 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/10"
                      >
                        Preview
                      </button>
                      <a
                        href={toApiFilesDownloadPath(itemUrl)}
                        download={isPassportItem ? passportDownloadName : undefined}
                        className="rounded border border-slate-300 dark:border-white/20 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/10"
                      >
                        Download
                      </a>
                      {!isPassportItem ? (
                        <a
                          href={toApiFilesDownloadPath(itemUrl)}
                          download
                          className="rounded border border-slate-300 dark:border-white/20 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/10"
                        >
                          Save
                        </a>
                      ) : null}
                      {item.deleteTarget && (
                        <button
                          type="button"
                          disabled={deletingTarget === targetKey}
                          onClick={() => {
                            void deleteUpload(
                              item.deleteTarget as DeleteTarget,
                              isPassportItem ? "Delete passport document? Cannot be undone." : undefined,
                            );
                          }}
                          className="rounded border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                        >
                          {deletingTarget === targetKey ? "Deleting..." : "Delete"}
                        </button>
                      )}
                    </>
                  ) : isPassportItem ? (
                    <Link
                      href="/student/profile#passport"
                      className="rounded border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                    >
                      Upload
                    </Link>
                  ) : (
                    <div className="w-full max-w-xl">
                      <ChecklistUploadZone
                        compact
                        studentId={studentId || undefined}
                        documentField={item.id}
                        documentType="SMART_ITEM"
                        checklistItemName={item.label}
                        uploading={uploadingItemId === item.id}
                        onFileSelected={(file) => {
                          void uploadRequiredItem(item, file);
                        }}
                      />
                    </div>
                  )}
                </div>
              </article>
            );
          })}

          {requiredChecklist.length === 0 && <p className="text-sm text-slate-500">No required checklist items found.</p>}
        </div>
      </section>

      <section className="glass-card p-6">
        <h2 className="text-lg font-semibold text-slate-900">All Uploaded Documents</h2>
        <div className="mt-4 space-y-3">
          {uploadedDocuments.map((doc) => {
            const resolvedUrl = doc.fileUrl;
            const targetKey = doc.deleteTarget ? `${doc.deleteTarget.sourceType}:${doc.deleteTarget.sourceId}` : null;
            return (
              <article key={doc.id} className="rounded-xl border border-white/40 bg-white/50 dark:border-white/10 dark:bg-white/5 p-4 backdrop-blur-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{doc.documentName}</p>
                    <p className="text-xs text-slate-500">
                      {doc.documentType.replaceAll("_", " ")} • Uploaded {new Date(doc.uploadedAt).toLocaleString("en-GB")} • {formatBytes(doc.fileSize)}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(doc.status)}`}>{statusLabel(doc.status)}</span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewDoc({ name: doc.documentName, url: resolvedUrl })}
                    className="rounded border border-slate-300 dark:border-white/20 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/10"
                  >
                    Preview
                  </button>
                  <a
                    href={toApiFilesDownloadPath(resolvedUrl)}
                    className="rounded border border-slate-300 dark:border-white/20 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/10"
                  >
                    Download
                  </a>
                  {doc.deleteTarget && (
                    <button
                      type="button"
                      disabled={deletingTarget === targetKey}
                      onClick={() => {
                        void deleteUpload(doc.deleteTarget as DeleteTarget);
                      }}
                      className="rounded border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                    >
                      {deletingTarget === targetKey ? "Deleting..." : "Delete"}
                    </button>
                  )}
                </div>
              </article>
            );
          })}

          {uploadedDocuments.length === 0 && <p className="text-sm text-slate-500">No uploaded documents found yet.</p>}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Smart Document Vault</h2>
        <p className="mt-1 text-sm text-slate-500">Upload any extra file and the system will try to fit it into the right document bucket.</p>
        <div className="mt-3 max-w-lg">
          <ChecklistUploadZone
            compact={false}
            uploading={vaultUploading}
            studentId={studentId || undefined}
            documentField="SMART_VAULT"
            documentType="SMART_UPLOAD"
            onFileSelected={(file) => {
              void uploadToVault(file);
            }}
          />
        </div>
      </section>

      {previewDoc && <DocumentPreviewModal fileUrl={previewDoc.url} fileName={previewDoc.name} onClose={() => setPreviewDoc(null)} />}
    </main>
  );
}