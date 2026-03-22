"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, X } from "lucide-react";
import DocumentPreviewModal from "@/components/shared/DocumentPreviewModal";
import { toApiFilesDownloadPath, toApiFilesPath } from "@/lib/file-url";

type HubRow = {
  allChecklistItemsVerified: boolean;
  certificateAlreadyGenerated: boolean;
  id: string;
  checklistId: string;
  label: string;
  documentType: string;
  studentId: string;
  studentName: string;
  counsellorId: string | null;
  counsellorName: string;
  applicationId: string | null;
  universityName: string;
  courseName: string;
  status: "PENDING_REVIEW" | "VERIFIED" | "REVISION_REQUIRED" | "REJECTED";
  riskLevel: "UNKNOWN" | "LOW" | "MEDIUM" | "HIGH";
  ocrConfidence: number | null;
  fraudFlags: string[];
  uploadedAt: string | null;
  reviewedAt: string | null;
  fileName: string | null;
  fileUrl: string | null;
};

type DetailData = {
  id: string;
  checklistId: string;
  label: string;
  documentType: string;
  status: string;
  counsellorNote: string | null;
  ocrStatus: string | null;
  ocrData: unknown;
  ocrConfidence: number | null;
  fraudRiskLevel: string;
  fraudFlags: string[];
  student: {
    id: string;
    name: string;
    email: string;
    counsellorName: string;
  };
  application: {
    id: string | null;
    university: string;
    course: string;
  };
  document: {
    id: string;
    fileName: string;
    fileUrl: string;
    status: string;
    uploadedAt: string;
    scan: {
      status: string;
      plagiarismScore: number | null;
      aiScore: number | null;
      flagColour: string | null;
      counsellorDecision: string | null;
      counsellorNote: string | null;
      reviewedAt: string | null;
      isLocked: boolean;
      reportUrl: string | null;
    } | null;
  };
};

type Props = {
  role: string;
};

type OcrFieldEntry = {
  name: string;
  value: string;
  confidencePct: number | null;
};

function confidenceValue(value: number | null) {
  if (value === null || Number.isNaN(value)) return 0;
  if (value <= 1) return Math.round(value * 100);
  return Math.round(value);
}

function ConfidenceDots({ value }: { value: number | null }) {
  const pct = confidenceValue(value);
  const level = pct >= 80 ? 3 : pct >= 55 ? 2 : pct > 0 ? 1 : 0;

  return (
    <div className="inline-flex items-center gap-1">
      {[1, 2, 3].map((idx) => (
        <span
          key={idx}
          className={`h-2.5 w-2.5 rounded-full ${
            idx <= level ? "bg-emerald-500" : "bg-slate-200"
          }`}
        />
      ))}
      <span className="ml-1 text-xs text-slate-500">{pct}%</span>
    </div>
  );
}

function normaliseConfidence(value: unknown): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  if (value <= 1) return Math.round(value * 100);
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getConfidenceDotClass(value: number | null) {
  if (value === null) return "bg-slate-300";
  if (value > 80) return "bg-emerald-500";
  if (value >= 50) return "bg-amber-500";
  return "bg-red-500";
}

function prettifyKey(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (match) => match.toUpperCase());
}

function valueToString(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((entry) => valueToString(entry)).join(", ");
  return JSON.stringify(value);
}

function extractOcrFields(ocrData: unknown, fallbackConfidence: number | null): OcrFieldEntry[] {
  if (!ocrData || typeof ocrData !== "object") return [];
  const data = ocrData as Record<string, unknown>;
  const fallback = normaliseConfidence(fallbackConfidence);

  if (typeof data.surname === "string" || typeof data.givenNames === "string") {
    return [
      {
        name: "Name",
        value: `${String(data.givenNames || "")} ${String(data.surname || "")}`.trim() || "-",
        confidencePct: fallback,
      },
      {
        name: "Date Of Birth",
        value: valueToString(data.dateOfBirth),
        confidencePct: fallback,
      },
      {
        name: "Expiry",
        value: valueToString(data.expiryDate),
        confidencePct: fallback,
      },
      {
        name: "Document Number",
        value: valueToString(data.documentNumber),
        confidencePct: fallback,
      },
    ];
  }

  if (typeof data.accountHolderName === "string") {
    return [
      { name: "Account Holder", value: valueToString(data.accountHolderName), confidencePct: fallback },
      { name: "Statement Date", value: valueToString(data.statementDate), confidencePct: fallback },
      { name: "Closing Balance", value: valueToString(data.closingBalance), confidencePct: fallback },
    ];
  }

  const rows: OcrFieldEntry[] = [];
  for (const [key, raw] of Object.entries(data)) {
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const nested = raw as Record<string, unknown>;
      if ("value" in nested || "confidence" in nested || "score" in nested) {
        rows.push({
          name: prettifyKey(key),
          value: valueToString(nested.value ?? "-"),
          confidencePct: normaliseConfidence(nested.confidence ?? nested.score) ?? fallback,
        });
        continue;
      }
    }

    rows.push({
      name: prettifyKey(key),
      value: valueToString(raw),
      confidencePct: fallback,
    });
  }

  return rows.filter((row) => row.value && row.value !== "-");
}

function StatusBadge({ status }: { status: HubRow["status"] }) {
  const map: Record<HubRow["status"], string> = {
    PENDING_REVIEW: "bg-slate-100 text-slate-700",
    VERIFIED: "bg-emerald-100 text-emerald-700",
    REVISION_REQUIRED: "bg-amber-100 text-amber-700",
    REJECTED: "bg-red-100 text-red-700",
  };

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${map[status]}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

export default function DocumentVerificationClient({ role }: Props) {
  const [rows, setRows] = useState<HubRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState("PENDING_REVIEW");
  const [risk, setRisk] = useState("ALL");
  const [search, setSearch] = useState("");
  const [counsellorId, setCounsellorId] = useState("ALL");

  const [selected, setSelected] = useState<string[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);

  const [counsellors, setCounsellors] = useState<Array<{ id: string; name: string | null; email: string }>>([]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailNote, setDetailNote] = useState("");
  const [detailActionLoading, setDetailActionLoading] = useState(false);
  const [detailMessage, setDetailMessage] = useState<string | null>(null);
  const [certificateLoading, setCertificateLoading] = useState(false);
  const [rowCertificateLoadingId, setRowCertificateLoadingId] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ fileName: string; fileUrl: string } | null>(null);
  const [deletingDocument, setDeletingDocument] = useState(false);

  const isAdmin = role === "ADMIN";

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        status,
        risk,
      });
      if (search.trim()) params.set("search", search.trim());
      if (counsellorId !== "ALL") params.set("counsellorId", counsellorId);

      const res = await fetch(`/api/admin/document-verification?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load document verification list");
      setRows(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load verification list");
    } finally {
      setLoading(false);
    }
  }, [status, risk, search, counsellorId]);

  const fetchCounsellors = useCallback(async () => {
    if (role === "COUNSELLOR") return;
    try {
      const res = await fetch("/api/admin/settings/users?role=COUNSELLOR");
      const json = await res.json();
      if (res.ok) {
        setCounsellors(json.data?.users || []);
      }
    } catch {
      // non-fatal
    }
  }, [role]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  useEffect(() => {
    fetchCounsellors();
  }, [fetchCounsellors]);

  useEffect(() => {
    setSelected([]);
  }, [rows]);

  const selectedRows = useMemo(() => rows.filter((row) => selected.includes(row.id)), [rows, selected]);

  async function openDetail(itemId: string) {
    setActiveId(itemId);
    setDetail(null);
    setDetailNote("");
    setDetailMessage(null);
    setDetailLoading(true);

    try {
      const res = await fetch(`/api/admin/document-verification/${itemId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load review detail");
      setDetail(json.data);
      setDetailNote(json.data?.counsellorNote || "");
    } catch (err) {
      setDetailMessage(err instanceof Error ? err.message : "Failed to load detail");
    } finally {
      setDetailLoading(false);
    }
  }

  async function runAction(action: "VERIFY" | "REVISION_REQUIRED" | "REJECT" | "RESCAN") {
    if (!activeId) return;
    setDetailActionLoading(true);
    setDetailMessage(null);

    try {
      const res = await fetch(`/api/admin/document-verification/${activeId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: detailNote || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save action");

      setDetailMessage(`Action completed: ${action.replaceAll("_", " ")}`);
      await fetchRows();
      await openDetail(activeId);
    } catch (err) {
      setDetailMessage(err instanceof Error ? err.message : "Failed to save action");
    } finally {
      setDetailActionLoading(false);
    }
  }

  async function bulkVerify() {
    if (!selected.length) return;
    setBulkLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/document-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds: selected }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Bulk verification failed");
      setSelected([]);
      await fetchRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk verification failed");
    } finally {
      setBulkLoading(false);
    }
  }

  async function generateCertificate() {
    if (!detail?.checklistId) return;
    setCertificateLoading(true);
    setDetailMessage(null);
    try {
      const res = await fetch(`/api/admin/checklists/${detail.checklistId}/generate-certificate`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to generate certificate");
      setDetailMessage(`Certificate generated (${json.data.verificationRef})`);
      await fetchRows();
    } catch (err) {
      setDetailMessage(err instanceof Error ? err.message : "Failed to generate certificate");
    } finally {
      setCertificateLoading(false);
    }
  }

  async function generateCertificateForChecklist(checklistId: string) {
    setRowCertificateLoadingId(checklistId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/checklists/${checklistId}/generate-certificate`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to generate certificate");
      await fetchRows();
      setDetailMessage(`Certificate generated (${json.data.verificationRef})`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate certificate");
    } finally {
      setRowCertificateLoadingId(null);
    }
  }

  async function deleteDocument(documentId: string) {
    const confirmed = window.confirm("Are you sure you want to delete this document?");
    if (!confirmed) return;

    try {
      setDeletingDocument(true);
      const res = await fetch(`/api/documents/${documentId}`, { method: "DELETE" });
      const json = await res.json() as { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to delete document");

      setDetailMessage("Document deleted successfully.");
      setActiveId(null);
      await fetchRows();
    } catch (err) {
      setDetailMessage(err instanceof Error ? err.message : "Failed to delete document");
    } finally {
      setDeletingDocument(false);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Document Verification</h1>
        <p className="text-sm text-slate-600 mt-0.5">Review OCR confidence, fraud flags, and verify checklist documents.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-5">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student, document, university"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />

          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="ALL">All Statuses</option>
            <option value="PENDING_REVIEW">Pending Review</option>
            <option value="VERIFIED">Verified</option>
            <option value="REVISION_REQUIRED">Revision Required</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <select value={risk} onChange={(e) => setRisk(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="ALL">All Risks</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="UNKNOWN">Unknown</option>
          </select>

          {role !== "COUNSELLOR" ? (
            <select value={counsellorId} onChange={(e) => setCounsellorId(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="ALL">All Counsellors</option>
              {counsellors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || c.email}
                </option>
              ))}
            </select>
          ) : (
            <div />
          )}

          <button onClick={() => fetchRows()} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Apply Filters
          </button>
        </div>

        {isAdmin && (
          <div className="mt-3 flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-sm text-slate-600">Selected for bulk verify: {selectedRows.length}</p>
            <button
              onClick={bulkVerify}
              disabled={selectedRows.length === 0 || bulkLoading}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {bulkLoading ? "Verifying..." : "Bulk Verify"}
            </button>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
        {loading ? (
          <div className="p-5 text-sm text-slate-600 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                {isAdmin && <th className="px-4 py-3">Select</th>}
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Document</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Risk</th>
                <th className="px-4 py-3">OCR Confidence</th>
                <th className="px-4 py-3">Counsellor</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => openDetail(row.id)}>
                  {isAdmin && (
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.includes(row.id)}
                        onChange={(e) => {
                          setSelected((prev) =>
                            e.target.checked ? [...prev, row.id] : prev.filter((id) => id !== row.id),
                          );
                        }}
                      />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/students/${row.studentId}`} className="text-blue-700 hover:underline" onClick={(e) => e.stopPropagation()}>
                      {row.studentName}
                    </Link>
                    <p className="text-xs text-slate-500">{row.universityName}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{row.label}</p>
                    <p className="text-xs text-slate-500">{row.documentType}</p>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${row.riskLevel === "HIGH" ? "bg-red-100 text-red-700" : row.riskLevel === "MEDIUM" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700"}`}>
                      {row.riskLevel}
                    </span>
                  </td>
                  <td className="px-4 py-3"><ConfidenceDots value={row.ocrConfidence} /></td>
                  <td className="px-4 py-3">{row.counsellorName}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    {row.allChecklistItemsVerified && !row.certificateAlreadyGenerated ? (
                      <button
                        type="button"
                        disabled={rowCertificateLoadingId === row.checklistId}
                        onClick={() => {
                          void generateCertificateForChecklist(row.checklistId);
                        }}
                        className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {rowCertificateLoadingId === row.checklistId ? "Generating..." : "Generate Certificate"}
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="px-4 py-6 text-slate-500">No checklist documents match your filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {activeId && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setActiveId(null)} />
          <div className="relative h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Document Review</h2>
                {detail && <p className="text-sm text-slate-600 mt-1">{detail.student.name} · {detail.label}</p>}
              </div>
              <button onClick={() => setActiveId(null)} className="rounded-md border border-slate-200 p-2 text-slate-500 hover:bg-slate-50">
                <X className="h-4 w-4" />
              </button>
            </div>

            {detailLoading ? (
              <div className="text-sm text-slate-600 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading detail...</div>
            ) : detail ? (
              <div className="space-y-4">
                {(() => {
                  const resolvedDocumentUrl = toApiFilesPath(detail.document.fileUrl);
                  return (
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-sm font-medium text-slate-900">{detail.document.fileName}</p>
                  <p className="mt-1 text-xs text-slate-500">{detail.application.university} · {detail.application.course}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewDoc({ fileName: detail.document.fileName, fileUrl: resolvedDocumentUrl })}
                      className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700"
                    >
                      Preview
                    </button>
                    <a href={toApiFilesDownloadPath(resolvedDocumentUrl)} className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700">
                      Download
                    </a>
                    {isAdmin && (
                      <button
                        type="button"
                        disabled={deletingDocument}
                        onClick={() => {
                          void deleteDocument(detail.document.id);
                        }}
                        className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 disabled:opacity-50"
                      >
                        {deletingDocument ? "Deleting..." : "Delete"}
                      </button>
                    )}
                    {detail.document.scan?.reportUrl && (
                      <a href={detail.document.scan.reportUrl} target="_blank" className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700">
                        Open Scan Report
                      </a>
                    )}
                    {detail.application.id && (
                      <Link href={`/dashboard/applications/${detail.application.id}`} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700">
                        View Application
                      </Link>
                    )}
                  </div>
                </div>
                  );
                })()}

                <div className="rounded-lg border border-slate-200 p-3 text-sm">
                  <p className="font-medium text-slate-900">OCR & Fraud</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div>OCR confidence: <ConfidenceDots value={detail.ocrConfidence} /></div>
                    <div>Risk: <span className="font-medium">{detail.fraudRiskLevel}</span></div>
                    <div>Plagiarism: {detail.document.scan?.plagiarismScore ?? "-"}%</div>
                    <div>AI score: {detail.document.scan?.aiScore ?? "-"}%</div>
                  </div>
                  <div className="mt-2">
                    <p className="text-xs font-medium text-slate-600">Fraud flags</p>
                    {detail.fraudFlags.length ? (
                      <ul className="mt-1 list-disc pl-5 text-xs text-slate-700">
                        {detail.fraudFlags.map((flag) => (
                          <li key={flag}>{flag}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-xs text-slate-500">No fraud flags.</p>
                    )}
                  </div>

                  {extractOcrFields(detail.ocrData, detail.ocrConfidence).length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-slate-600">OCR Extracted Fields</p>
                      <div className="mt-2 space-y-2">
                        {extractOcrFields(detail.ocrData, detail.ocrConfidence).map((field) => (
                          <div key={`${field.name}:${field.value}`} className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xs font-medium text-slate-700">{field.name}</p>
                              <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                                <span className={`h-2 w-2 rounded-full ${getConfidenceDotClass(field.confidencePct)}`} />
                                {field.confidencePct !== null ? `${field.confidencePct}%` : "N/A"}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-slate-900 break-words">{field.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-slate-200 p-3">
                  <label className="text-xs font-medium text-slate-600">Counsellor note</label>
                  <textarea
                    value={detailNote}
                    onChange={(e) => setDetailNote(e.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Required for revision/reject actions"
                  />

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <button onClick={() => runAction("VERIFY")} disabled={detailActionLoading} className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
                      Verify
                    </button>
                    <button onClick={() => runAction("REVISION_REQUIRED")} disabled={detailActionLoading} className="rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50">
                      Request Revision
                    </button>
                    <button onClick={() => runAction("REJECT")} disabled={detailActionLoading} className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                      Reject
                    </button>
                    <button onClick={() => runAction("RESCAN")} disabled={detailActionLoading} className="rounded-md bg-slate-700 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
                      Re-run OCR Scan
                    </button>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 p-3">
                  <button
                    onClick={generateCertificate}
                    disabled={certificateLoading}
                    className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {certificateLoading ? "Generating..." : "Generate Verified Certificate"}
                  </button>
                </div>

                <iframe src={toApiFilesPath(detail.document.fileUrl)} title="Document preview" className="h-[420px] w-full rounded-lg border border-slate-200" />

                {detailMessage && (
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{detailMessage}</div>
                )}
              </div>
            ) : (
              <div className="text-sm text-slate-600">Unable to load detail.</div>
            )}
          </div>
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
