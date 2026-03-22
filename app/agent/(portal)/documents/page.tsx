"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import DocumentPreviewModal from "@/components/shared/DocumentPreviewModal";
import { toApiFilesDownloadPath, toApiFilesPath } from "@/lib/file-url";

type DocItem = {
  key: string;
  label: string;
  documentType: string;
  status: "PENDING" | "SCANNING" | "VERIFIED" | "REVISION_REQUIRED" | "REJECTED";
  isScannable: boolean;
  scanStatus: string | null;
  flagColour: string | null;
  counsellorDecision: string | null;
  counsellorNote: string | null;
  documentId: string | null;
  fileName: string | null;
  fileUrl: string | null;
  uploadedAt: string | null;
};

type StudentRow = {
  studentId: string;
  studentName: string;
  completeCount: number;
  pendingCount: number;
  flaggedCount: number;
  items: DocItem[];
};

function scanBadge(item: DocItem): { label: string; className: string; spinning?: boolean } {
  if (!item.isScannable) {
    return { label: "-", className: "bg-slate-100 text-slate-600" };
  }
  if (item.scanStatus === "SCANNING") {
    return { label: "Scanning in progress", className: "bg-blue-100 text-blue-700", spinning: true };
  }
  if (item.flagColour === "GREEN") {
    return { label: "Passed", className: "bg-emerald-100 text-emerald-700" };
  }
  if (item.flagColour === "AMBER") {
    return { label: "Review Required", className: "bg-amber-100 text-amber-700" };
  }
  if (item.flagColour === "RED") {
    return { label: "High Risk", className: "bg-red-100 text-red-700" };
  }

  if (item.status === "VERIFIED") {
    return { label: "Approved", className: "bg-emerald-100 text-emerald-700" };
  }
  if (item.status === "REVISION_REQUIRED") {
    return { label: "Revision Required", className: "bg-amber-100 text-amber-700" };
  }
  if (item.status === "REJECTED") {
    return { label: "Rejected", className: "bg-red-100 text-red-700" };
  }
  return { label: "Under Review", className: "bg-slate-100 text-slate-700" };
}

export default function AgentDocumentsPage() {
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ fileName: string; fileUrl: string } | null>(null);

  async function fetchRows() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/agent/documents");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load documents");
      setRows(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRows();
  }, []);

  async function uploadDocument(studentId: string, item: DocItem, file: File) {
    setUploadingKey(item.key);
    try {
      setInfo(null);
      const formData = new FormData();
      formData.append("files", file);
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const uploadJson = await uploadRes.json() as { urls?: string[]; error?: string; message?: string };
      if (!uploadRes.ok || !uploadJson.urls?.[0]) {
        throw new Error(uploadJson.error || "File upload failed");
      }

      const createRes = await fetch(`/api/agent/students/${studentId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: item.documentType,
          fileName: file.name,
          fileUrl: uploadJson.urls[0],
        }),
      });
      const createJson = await createRes.json();
      if (!createRes.ok) throw new Error(createJson.error || "Failed to create document record");
      const infoParts = [uploadJson.message, createJson.message].filter((value): value is string => Boolean(value));
      if (infoParts.length) {
        setInfo(infoParts.join(" "));
      }

      await fetchRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload document");
    } finally {
      setUploadingKey(null);
    }
  }

  async function deleteDocument(documentId: string) {
    const confirmed = window.confirm("Are you sure you want to delete this document?");
    if (!confirmed) return;

    setError(null);
    setInfo(null);
    try {
      const res = await fetch(`/api/documents/${documentId}`, { method: "DELETE" });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        throw new Error(json.error || "Failed to delete document");
      }
      setInfo("Document deleted successfully.");
      await fetchRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete document");
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Documents</h1>
        <p className="text-sm text-slate-500 mt-1">Upload and track student checklist documents. Verification is handled by counsellors.</p>
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">{error}</div>}
      {info && <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">{info}</div>}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-slate-600">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-sm text-slate-600">No students found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-200 text-slate-500">
                <th className="px-4 py-3">Student Name</th>
                <th className="px-4 py-3">Documents Complete count</th>
                <th className="px-4 py-3">Documents Pending count</th>
                <th className="px-4 py-3">Documents Flagged count</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Fragment key={row.studentId}>
                  <tr
                    onClick={() => setExpanded((current) => (current === row.studentId ? null : row.studentId))}
                    className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="px-4 py-3 font-medium text-slate-800">{row.studentName}</td>
                    <td className="px-4 py-3">{row.completeCount}</td>
                    <td className="px-4 py-3">{row.pendingCount}</td>
                    <td className="px-4 py-3">{row.flaggedCount}</td>
                  </tr>
                  {expanded === row.studentId && (
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <td className="px-4 py-4" colSpan={4}>
                        <div className="space-y-2">
                          {row.items.map((item) => (
                            <div key={item.key} className="rounded-md border border-slate-200 bg-white p-3 flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium text-slate-900">{item.label}</p>
                                {(() => {
                                  const badge = scanBadge(item);
                                  return (
                                <div className="flex items-center gap-2 mt-1">
                                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.className}`}>
                                    {badge.spinning && (
                                      <svg
                                        className="w-3 h-3 animate-spin"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      >
                                        <circle cx="12" cy="12" r="10" />
                                        <path d="M12 2a10 10 0 0 1 10 10" />
                                      </svg>
                                    )}
                                    {badge.label}
                                  </span>
                                  {item.fileUrl ? (
                                    <div className="flex flex-wrap items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setPreviewDoc({ fileName: item.fileName || "Document", fileUrl: toApiFilesPath(item.fileUrl) });
                                        }}
                                        className="text-xs text-blue-700 hover:underline"
                                      >
                                        {item.fileName || "View file"}
                                      </button>
                                      <a
                                        href={toApiFilesDownloadPath(item.fileUrl)}
                                        className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                                      >
                                        Download
                                      </a>
                                      {item.documentId && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (!item.documentId) return;
                                            void deleteDocument(item.documentId);
                                          }}
                                          className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                                        >
                                          Delete
                                        </button>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-slate-500">No file uploaded</span>
                                  )}
                                </div>
                                  );
                                })()}
                                {item.counsellorDecision === "REVISION_REQUIRED" && item.counsellorNote && (
                                  <p className="mt-1 text-xs text-amber-700">Revision Required: {item.counsellorNote}</p>
                                )}
                                {item.counsellorDecision === "REJECTED" && item.counsellorNote && (
                                  <p className="mt-1 text-xs text-red-700">Rejected: {item.counsellorNote}</p>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                <input
                                  id={`upload-${item.key}`}
                                  type="file"
                                  className="hidden"
                                  onChange={(e) => {
                                    const selected = e.target.files?.[0];
                                    if (selected) {
                                      uploadDocument(row.studentId, item, selected);
                                    }
                                    e.currentTarget.value = "";
                                  }}
                                />
                                <label
                                  htmlFor={`upload-${item.key}`}
                                  className="inline-flex items-center rounded-md bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 text-xs font-medium cursor-pointer"
                                >
                                  {uploadingKey === item.key ? "Uploading..." : "Upload"}
                                </label>
                                <Link
                                  href={`/agent/students/${row.studentId}`}
                                  className="inline-flex items-center rounded-md border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-2 text-xs font-medium"
                                >
                                  Open Student
                                </Link>
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

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
