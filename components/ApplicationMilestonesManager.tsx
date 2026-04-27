"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type RoleName = string;

type MilestoneType =
  | "OFFER_LETTER"
  | "CAS_LETTER"
  | "FINANCE_DEPOSIT_RECEIPT"
  | "VISA_COPY"
  | "ENROLMENT_CONFIRMATION";

type OfferType = "CONDITIONAL" | "UNCONDITIONAL";
type VisaOutcome = "APPROVED" | "REFUSED";

type DocumentRow = {
  id: string;
  milestoneType: MilestoneType;
  offerType: OfferType | null;
  visaOutcome: VisaOutcome | null;
  notes: string | null;
  fileName: string;
  fileUrl: string;
  uploadedByRole: string;
  createdAt: string;
  uploadedBy?: {
    id: string;
    name: string | null;
    role?: { name: string; label: string } | null;
  } | null;
};

type UploadModalState = {
  milestoneType: MilestoneType;
  title: string;
};

type FeeSummary = {
  feeRequired: boolean;
  displayStatus: "UNPAID" | "PENDING_APPROVAL" | "PAID" | "WAIVED" | "NOT_REQUIRED";
  amount: number;
  currency: string;
  feeType: "UCAS_SINGLE" | "UCAS_MULTIPLE" | "UNIVERSITY_DIRECT" | null;
  coveredByExisting: boolean;
  groupMessage: string | null;
};

type ApplicationMeta = {
  id: string;
  status: string;
  offerConditions?: string | null;
  createdAt: string;
  intake: string | null;
  studentName: string;
  universityName: string;
  universityCountry: string;
  courseName: string;
  courseLevel: string;
};

function parseConditions(text: string | null | undefined): string[] {
  if (!text) return [];
  const numbered = text.split(/\n?\s*\d+[\.\)]\s+/).filter(Boolean);
  if (numbered.length > 1) return numbered.map((s) => s.trim()).filter(Boolean);
  return text.split("\n").map((s) => s.trim()).filter(Boolean);
}

type Props = {
  applicationId: string;
  roleName: RoleName;
  portalLabel: "student" | "dashboard" | "agent";
};

const MILESTONES: Array<{ type: MilestoneType; title: string; subtitle?: string }> = [
  { type: "OFFER_LETTER", title: "Offer Letter", subtitle: "Conditional or Unconditional" },
  { type: "CAS_LETTER", title: "CAS Letter", subtitle: "Admin/Manager/Counsellor upload only" },
  { type: "FINANCE_DEPOSIT_RECEIPT", title: "Finance Deposit Receipt" },
  { type: "VISA_COPY", title: "Visa Copy", subtitle: "Approved or Refused" },
  { type: "ENROLMENT_CONFIRMATION", title: "Enrolment Confirmation" },
];

function canUploadCas(roleName: string) {
  return ["ADMIN", "MANAGER", "COUNSELLOR"].includes(roleName);
}

function toBlob(dataUrl: string, mimeType: string) {
  const base64 = dataUrl.split(",")[1] || "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

function buildTimeline(documents: DocumentRow[]) {
  const byType = {
    conditionalOffer: documents.find((doc) => doc.milestoneType === "OFFER_LETTER" && doc.offerType === "CONDITIONAL"),
    unconditionalOffer: documents.find((doc) => doc.milestoneType === "OFFER_LETTER" && doc.offerType === "UNCONDITIONAL"),
    deposit: documents.find((doc) => doc.milestoneType === "FINANCE_DEPOSIT_RECEIPT"),
    cas: documents.find((doc) => doc.milestoneType === "CAS_LETTER"),
    visaApproved: documents.find((doc) => doc.milestoneType === "VISA_COPY" && doc.visaOutcome === "APPROVED"),
    visaRefused: documents.find((doc) => doc.milestoneType === "VISA_COPY" && doc.visaOutcome === "REFUSED"),
    enrolled: documents.find((doc) => doc.milestoneType === "ENROLMENT_CONFIRMATION"),
  };

  const visaDoc = byType.visaApproved || byType.visaRefused;

  return [
    {
      event: "Conditional Offer Received",
      doc: byType.conditionalOffer,
    },
    {
      event: "Unconditional Offer Received",
      doc: byType.unconditionalOffer,
    },
    {
      event: "Deposit Paid",
      doc: byType.deposit,
    },
    {
      event: "CAS Letter Issued",
      doc: byType.cas,
    },
    {
      event: byType.visaApproved ? "Visa Approved" : byType.visaRefused ? "Visa Refused" : "Visa Approved OR Visa Refused",
      doc: visaDoc,
    },
    {
      event: "Enrolled",
      doc: byType.enrolled,
    },
  ];
}

function statusPill(status: string) {
  const normalised = status.toUpperCase();
  if (normalised.includes("ENROLLED")) return "bg-emerald-100 text-emerald-700";
  if (normalised.includes("WITHDRAWN")) return "bg-slate-200 text-slate-700";
  if (normalised.includes("VISA")) return "bg-purple-100 text-purple-700";
  if (normalised.includes("OFFER")) return "bg-blue-100 text-blue-700";
  if (normalised.includes("FINANCE") || normalised.includes("DEPOSIT")) return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

export default function ApplicationMilestonesManager({ applicationId, roleName, portalLabel }: Props) {
  const [rows, setRows] = useState<DocumentRow[]>([]);
  const [application, setApplication] = useState<ApplicationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [fee, setFee] = useState<FeeSummary | null>(null);
  const [feeLoading, setFeeLoading] = useState(false);
  const [feeActionLoading, setFeeActionLoading] = useState(false);

  const [modal, setModal] = useState<UploadModalState | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [offerType, setOfferType] = useState<OfferType>("CONDITIONAL");
  const [visaOutcome, setVisaOutcome] = useState<VisaOutcome>("APPROVED");
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [conditionModalLabel, setConditionModalLabel] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/applications/${applicationId}/documents`, { cache: "no-store" });
      const json = (await res.json()) as { data?: DocumentRow[]; application?: ApplicationMeta; error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to load milestone documents");
      const next = (json.data || []).slice().sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setRows(next);
      setApplication(json.application || null);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load milestone documents");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  async function refreshFee() {
    if (portalLabel === "student") return;
    setFeeLoading(true);
    try {
      const res = await fetch(`/api/dashboard/applications/${applicationId}/fee`, { cache: "no-store" });
      const json = (await res.json()) as { data?: { fee?: FeeSummary }; error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to load application fee status");
      setFee(json.data?.fee || null);
    } catch (feeError) {
      setError(feeError instanceof Error ? feeError.message : "Failed to load application fee status");
    } finally {
      setFeeLoading(false);
    }
  }

  useEffect(() => {
    if (portalLabel === "student") return;
    void refreshFee();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId, portalLabel]);

  async function runFeeAction(action: "inviteStudent" | "payOnBehalf" | "approvePayment" | "approveWaiver") {
    setFeeActionLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/dashboard/applications/${applicationId}/fee`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "payOnBehalf"
            ? { action, paymentMethod: "BANK_TRANSFER" }
            : { action },
        ),
      });
      const json = (await res.json()) as { data?: { fee?: FeeSummary }; error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to update fee");

      if (json.data?.fee) {
        setFee(json.data.fee);
      } else {
        await refreshFee();
      }

      if (action === "inviteStudent") setMessage("Student was invited to pay the application fee.");
      if (action === "payOnBehalf") setMessage("Application fee has been recorded as paid on behalf.");
      if (action === "approvePayment") setMessage("Application fee payment approved.");
      if (action === "approveWaiver") setMessage("Application fee waiver approved.");
    } catch (feeActionError) {
      setError(feeActionError instanceof Error ? feeActionError.message : "Failed to update fee");
    } finally {
      setFeeActionLoading(false);
    }
  }

  const timeline = useMemo(() => buildTimeline(rows), [rows]);
  const completedTimelineCount = timeline.filter((item) => Boolean(item.doc)).length;
  const timelineProgress = timeline.length > 0 ? Math.round((completedTimelineCount / timeline.length) * 100) : 0;
  const nextPending = timeline.find((item) => !item.doc)?.event || "All milestones completed";

  function pickFile(f: File) {
    setFile(f);
  }

  async function saveMilestoneDocument() {
    if (!modal || !file) return;
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      // Upload file to storage first
      const form = new FormData();
      form.append("files", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: form });
      const uploadJson = (await uploadRes.json()) as { urls?: string[]; error?: string };
      if (!uploadRes.ok || !uploadJson.urls?.[0]) {
        throw new Error(uploadJson.error || "File upload failed");
      }

      const payload: Record<string, unknown> = {
        milestoneType: modal.milestoneType,
        fileName: file.name,
        fileUrl: uploadJson.urls[0],
      };

      if (modal.milestoneType === "OFFER_LETTER") payload.offerType = offerType;
      if (modal.milestoneType === "VISA_COPY") payload.visaOutcome = visaOutcome;
      if (conditionModalLabel) payload.notes = conditionModalLabel;

      const res = await fetch(`/api/applications/${applicationId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to upload milestone document");

      toast.success("Document uploaded successfully.");
      setModal(null);
      setFile(null);
      setConditionModalLabel(null);
      await load();
    } catch (saveError) {
      const msg = saveError instanceof Error ? saveError.message : "Failed to upload milestone document";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  function openConditionUpload(conditionLabel: string) {
    setConditionModalLabel(conditionLabel);
    setModal({ milestoneType: "OFFER_LETTER", title: "Conditional Offer Document" });
    setOfferType("CONDITIONAL");
    setFile(null);
    setDragOver(false);
  }

  async function deleteDocument(documentId: string) {
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/applications/${applicationId}/documents/${documentId}`, {
        method: "DELETE",
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to delete document");
      setMessage("Document deleted.");
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete document");
    }
  }

  if (loading) {
    return <p className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600">Loading milestone documents...</p>;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Application Details</p>
            <h1 className="mt-1 text-xl font-semibold text-slate-900">
              {application?.studentName || "Student"} • {application?.courseName || "Course"}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {application?.universityName || "University"}
              {application?.universityCountry ? ` • ${application.universityCountry}` : ""}
              {application?.intake ? ` • Intake ${application.intake}` : ""}
            </p>
          </div>
          {application?.status && (
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusPill(application.status)}`}>
              {application.status.replaceAll("_", " ")}
            </span>
          )}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-xs font-medium uppercase text-slate-500">Timeline Progress</p>
            <p className="mt-1 text-lg font-semibold text-slate-800">{completedTimelineCount}/{timeline.length} ({timelineProgress}%)</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-xs font-medium uppercase text-slate-500">Next Action</p>
            <p className="mt-1 text-sm font-semibold text-slate-800">{nextPending}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-xs font-medium uppercase text-slate-500">Created</p>
            <p className="mt-1 text-sm font-semibold text-slate-800">
              {application?.createdAt ? new Date(application.createdAt).toLocaleDateString("en-GB") : "-"}
            </p>
          </div>
        </div>
      </section>

      {portalLabel !== "student" && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Application Fee</h2>
              {feeLoading ? (
                <p className="mt-1 text-sm text-slate-600">Loading fee status...</p>
              ) : fee ? (
                <>
                  <p className="mt-1 text-sm text-slate-700">
                    {fee.feeRequired
                      ? `${fee.amount.toFixed(2)} ${fee.currency} • ${(fee.feeType || "FEE").replaceAll("_", " ")}`
                      : "No fee required for this application."}
                  </p>
                  {fee.groupMessage ? <p className="mt-1 text-xs text-slate-500">{fee.groupMessage}</p> : null}
                </>
              ) : (
                <p className="mt-1 text-sm text-slate-600">Fee details unavailable.</p>
              )}
            </div>

            {fee?.feeRequired && (
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  fee.displayStatus === "UNPAID"
                    ? "bg-rose-100 text-rose-700"
                    : fee.displayStatus === "PENDING_APPROVAL"
                      ? "bg-amber-100 text-amber-700"
                      : fee.displayStatus === "PAID"
                        ? "bg-emerald-100 text-emerald-700"
                        : fee.displayStatus === "WAIVED"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-slate-100 text-slate-700"
                }`}
              >
                {fee.displayStatus.replaceAll("_", " ")}
              </span>
            )}
          </div>

          {fee?.feeRequired && (fee.displayStatus === "UNPAID" || fee.displayStatus === "PENDING_APPROVAL") && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Fee must be PAID or WAIVED before moving beyond Applied.
            </div>
          )}

          {fee?.feeRequired && (
            <div className="mt-3 flex flex-wrap gap-2">
              {(fee.displayStatus === "UNPAID" || fee.displayStatus === "PENDING_APPROVAL") && (
                <button
                  type="button"
                  disabled={feeActionLoading}
                  onClick={() => {
                    void runFeeAction("inviteStudent");
                  }}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-60"
                >
                  Invite Student to Pay
                </button>
              )}

              {fee.displayStatus === "UNPAID" && ["ADMIN", "MANAGER", "COUNSELLOR", "SUB_AGENT"].includes(roleName) && (
                <button
                  type="button"
                  disabled={feeActionLoading}
                  onClick={() => {
                    void runFeeAction("payOnBehalf");
                  }}
                  className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                >
                  Pay for Student (On Behalf)
                </button>
              )}

              {fee.displayStatus === "PENDING_APPROVAL" && ["ADMIN", "MANAGER"].includes(roleName) && (
                <>
                  <button
                    type="button"
                    disabled={feeActionLoading}
                    onClick={() => {
                      void runFeeAction("approvePayment");
                    }}
                    className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    Approve Payment
                  </button>
                  <button
                    type="button"
                    disabled={feeActionLoading}
                    onClick={() => {
                      void runFeeAction("approveWaiver");
                    }}
                    className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    Approve Waiver
                  </button>
                </>
              )}
            </div>
          )}
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-slate-900">Milestone Documents ({portalLabel})</h2>
        <div className="mt-4 space-y-3">
          {MILESTONES.map((milestone) => {
            const docs = rows.filter((row) => row.milestoneType === milestone.type);
            const casRestricted = milestone.type === "CAS_LETTER" && !canUploadCas(roleName);

            return (
              <div key={milestone.type} className="rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{milestone.title}</p>
                    {milestone.subtitle ? <p className="text-xs text-slate-500">{milestone.subtitle}</p> : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => setModal({ milestoneType: milestone.type, title: milestone.title })}
                    disabled={casRestricted}
                    className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Upload
                  </button>
                </div>

                <div className="mt-3 space-y-2">
                  {docs.length === 0 ? (
                    <p className="text-xs text-slate-500">No file uploaded yet.</p>
                  ) : (
                    docs.map((doc) => (
                      <div key={doc.id} className="rounded-md border border-slate-200 p-2">
                        <p className="text-xs font-semibold text-slate-800">{doc.fileName}</p>
                        <p className="text-[11px] text-slate-500">
                          {new Date(doc.createdAt).toLocaleString("en-GB")} by {doc.uploadedBy?.name || "Unknown"} ({doc.uploadedByRole})
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const blob = toBlob(doc.fileUrl, "application/octet-stream");
                              const url = URL.createObjectURL(blob);
                              window.open(url, "_blank", "noopener,noreferrer");
                              setTimeout(() => URL.revokeObjectURL(url), 4000);
                            }}
                            className="rounded-md border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700"
                          >
                            Preview
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const blob = toBlob(doc.fileUrl, "application/octet-stream");
                              const url = URL.createObjectURL(blob);
                              const anchor = window.document.createElement("a");
                              anchor.href = url;
                              anchor.download = doc.fileName;
                              anchor.click();
                              URL.revokeObjectURL(url);
                            }}
                            className="rounded-md border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700"
                          >
                            Download
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteDocument(doc.id)}
                            className="rounded-md border border-red-300 px-2 py-1 text-[11px] font-semibold text-red-700"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Conditional offer requirements */}
      {application?.status === "CONDITIONAL_OFFER" && application.offerConditions && (() => {
        const conditions = parseConditions(application.offerConditions);
        const conditionDocs = rows.filter((r) => r.milestoneType === "OFFER_LETTER" && r.offerType === "CONDITIONAL" && r.notes);
        return conditions.length > 0 ? (
          <section className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
            <div className="flex items-start gap-2 mb-3">
              <span className="text-lg">⚠️</span>
              <div>
                <h2 className="text-base font-bold text-amber-900">Conditional Offer — Documents Required</h2>
                <p className="text-xs text-amber-700 mt-0.5">The following conditions must be satisfied. Upload supporting documents for each.</p>
              </div>
            </div>
            <div className="space-y-3">
              {conditions.map((condition, idx) => {
                const uploaded = conditionDocs.filter((d) => d.notes === condition);
                return (
                  <div key={idx} className="rounded-lg border border-amber-200 bg-white p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2 flex-1">
                        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${uploaded.length > 0 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                          {uploaded.length > 0 ? "✓" : idx + 1}
                        </span>
                        <p className="text-sm text-slate-800">{condition}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openConditionUpload(condition)}
                        className="shrink-0 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                      >
                        Upload
                      </button>
                    </div>
                    {uploaded.length > 0 && (
                      <div className="mt-2 space-y-1 pl-7">
                        {uploaded.map((d) => (
                          <p key={d.id} className="text-xs text-emerald-700">✓ {d.fileName} — {new Date(d.createdAt).toLocaleDateString("en-GB")}</p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null;
      })()}

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-slate-900">Application Timeline</h2>
        <div className="mt-4 space-y-2">
          {timeline.map((item, index) => (
            <div key={item.event} className="rounded-md border border-slate-200 p-3 text-sm">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex flex-col items-center">
                  <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${item.doc ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                    {item.doc ? "✓" : index + 1}
                  </span>
                  {index < timeline.length - 1 && <span className="mt-1 h-6 w-px bg-slate-300" />}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-900">{item.event}</p>
                  {item.doc ? (
                    <p className="text-xs text-slate-600">
                      {new Date(item.doc.createdAt).toLocaleDateString("en-GB")} by {item.doc.uploadedBy?.name || "Unknown"} ({item.doc.uploadedByRole})
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500">Pending</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-slate-900">Upload {modal.title}</h3>
            {conditionModalLabel && (
              <p className="mt-1 text-xs text-amber-700 font-medium bg-amber-50 rounded px-2 py-1">
                Condition: {conditionModalLabel}
              </p>
            )}
            <p className="mt-1 text-xs text-slate-500">Drag & drop a file or click the area below to choose.</p>

            {/* Drop zone */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) pickFile(f);
              }}
              className={`mt-4 flex min-h-[160px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                dragOver ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100"
              }`}
            >
              {file ? (
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-emerald-700">✓ {file.name}</p>
                  <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(0)} KB — click to change</p>
                </div>
              ) : (
                <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-200">
                    <svg className="h-6 w-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-slate-700">Drop file here or <span className="text-blue-600 underline">browse</span></p>
                  <p className="text-xs text-slate-400">PDF, JPG, PNG, DOC, DOCX supported</p>
                </>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,application/pdf,image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) pickFile(f);
                e.currentTarget.value = "";
              }}
            />

            {modal.milestoneType === "OFFER_LETTER" && !conditionModalLabel && (
              <select
                value={offerType}
                onChange={(event) => setOfferType(event.target.value as OfferType)}
                className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="CONDITIONAL">Conditional</option>
                <option value="UNCONDITIONAL">Unconditional</option>
              </select>
            )}

            {modal.milestoneType === "VISA_COPY" && (
              <select
                value={visaOutcome}
                onChange={(event) => setVisaOutcome(event.target.value as VisaOutcome)}
                className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="APPROVED">Approved</option>
                <option value="REFUSED">Refused</option>
              </select>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setModal(null);
                  setFile(null);
                  setConditionModalLabel(null);
                  setDragOver(false);
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveMilestoneDocument()}
                disabled={!file || saving}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Uploading…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {message && <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
    </div>
  );
}
