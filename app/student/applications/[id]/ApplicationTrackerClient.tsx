"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, Lock, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import ApplicationFinanceTab from "@/app/dashboard/applications/[id]/ApplicationFinanceTab";
import ChecklistUploadZone from "@/components/ui/ChecklistUploadZone";
import { MessagesThread } from "@/components/MessagesThread";
import ApplicationInterviewTracking from "@/components/ApplicationInterviewTracking";
import DocumentPreviewModal from "@/components/shared/DocumentPreviewModal";
import { toApiFilesDownloadPath, toApiFilesPath } from "@/lib/file-url";

type AppStatus =
  | "APPLIED"
  | "DOCUMENTS_PENDING"
  | "DOCUMENTS_SUBMITTED"
  | "SUBMITTED_TO_UNIVERSITY"
  | "CONDITIONAL_OFFER"
  | "UNCONDITIONAL_OFFER"
  | "FINANCE_IN_PROGRESS"
  | "DEPOSIT_PAID"
  | "FINANCE_COMPLETE"
  | "CAS_ISSUED"
  | "VISA_APPLIED"
  | "ENROLLED"
  | "WITHDRAWN";

type DetailPayload = {
  id: string;
  status: AppStatus;
  visaSubStatus?: "VISA_PENDING" | "VISA_APPROVED" | "VISA_REJECTED" | null;
  visaRejectionReason?: string | null;
  offerConditions?: string | null;
  casNumber?: string | null;
  createdAt: string;
  submittedAt: string | null;
  submittedToUniversityAt?: string | null;
  conditionalOfferAt?: string | null;
  unconditionalOfferAt?: string | null;
  financeCompleteAt?: string | null;
  casIssuedAt?: string | null;
  visaAppliedAt?: string | null;
  enrolledAt?: string | null;
  withdrawnAt?: string | null;
  offerReceivedAt: string | null;
  intake: { date?: string; deadline?: string } | null;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    nationality: string | null;
  };
  university: {
    id: string;
    name: string;
    logo: string | null;
    country: string;
  };
  course: {
    id: string;
    name: string;
  };
  fee: {
    feeRequired: boolean;
    displayStatus: "UNPAID" | "PENDING_APPROVAL" | "PAID" | "WAIVED" | "NOT_REQUIRED";
    amount: number;
    currency: string;
  };
  statusHistory: Array<{
    id: string;
    status: string;
    createdAt: string;
    notes: string | null;
    changedBy: {
      id: string;
      name: string | null;
      email: string;
    };
  }>;
  milestones: Array<{
    id: string;
    milestone: "APPLICATION_SUBMISSION" | "OFFER_LETTER" | "FINANCE" | "CAS" | "VISA";
    title: string;
    description: string | null;
    required: boolean;
    status: "MISSING" | "UPLOADED" | "VERIFIED" | "REJECTED";
    fileName: string | null;
    fileUrl: string | null;
    uploadedAt: string | null;
    verifiedAt: string | null;
    notes: string | null;
  }>;
  offerLetter: {
    documentId: string | null;
    fileName: string | null;
    fileUrl: string | null;
    uploadedAt: string | null;
    ocr: {
      courseFee: number | null;
      scholarship: number | null;
      currency: string | null;
      extractedText: string;
      confidence: number | null;
    } | null;
  } | null;
};

type ChecklistItem = {
  id: string;
  label: string;
  status: "PENDING" | "SCANNING" | "REVISION_REQUIRED" | "VERIFIED" | "REJECTED";
  reason: string | null;
  documentId: string | null;
  fileName: string | null;
  fileUrl: string | null;
};

type ChecklistPayload = {
  checklistId: string | null;
  verifiedCount: number;
  totalCount: number;
  completionPct: number;
  allVerified: boolean;
  items: ChecklistItem[];
};

type ScholarshipRow = {
  id: string;
  name: string;
  amount: number;
  amountType: "FIXED" | "PERCENTAGE";
  percentageOf: "TUITION" | "LIVING" | "TOTAL" | null;
  currency: string;
  deadline: string | null;
  isPartial: boolean;
  eligibilityCriteria: string;
  currentStatus: "INTERESTED" | "APPLIED" | "SHORTLISTED" | "AWARDED" | "REJECTED" | null;
  appliedAt: string | null;
  awardedAmount: number | null;
};

type CountrySpecificFinanceDoc = {
  key: "PASSPORT" | "ACADEMIC" | "ENGLISH_TEST" | "TB_TEST" | "POST_STUDY_PLAN" | "BANK_STATEMENT";
  label: string;
  status: "DONE" | "TODO";
  required: boolean;
  checklistItemId: string | null;
  uploadDocumentType: string | null;
};

const STATUS_UI: Record<AppStatus, { label: string; badge: string }> = {
  APPLIED: { label: "Application Submitted", badge: "bg-slate-100 text-slate-700" },
  DOCUMENTS_PENDING: { label: "Documents Pending", badge: "bg-amber-100 text-amber-700" },
  DOCUMENTS_SUBMITTED: { label: "Documents Verified", badge: "bg-blue-100 text-blue-700" },
  SUBMITTED_TO_UNIVERSITY: { label: "Submitted to University", badge: "bg-indigo-100 text-indigo-700" },
  CONDITIONAL_OFFER: { label: "Conditional Offer", badge: "bg-yellow-100 text-yellow-700" },
  UNCONDITIONAL_OFFER: { label: "Unconditional Offer", badge: "bg-emerald-100 text-emerald-700" },
  FINANCE_IN_PROGRESS: { label: "Finance Started", badge: "bg-cyan-100 text-cyan-700" },
  DEPOSIT_PAID: { label: "Deposit Confirmed", badge: "bg-teal-100 text-teal-700" },
  FINANCE_COMPLETE: { label: "Finance Complete", badge: "bg-green-100 text-green-700" },
  CAS_ISSUED: { label: "CAS Issued", badge: "bg-indigo-100 text-indigo-700" },
  VISA_APPLIED: { label: "Visa Applied", badge: "bg-purple-100 text-purple-700" },
  ENROLLED: { label: "Enrolled", badge: "bg-teal-100 text-teal-700" },
  WITHDRAWN: { label: "Withdrawn", badge: "bg-slate-100 text-slate-700" },
};

const TRACKER_STAGES = [
  "Application Submitted",
  "Documents Requested",
  "Documents Verified",
  "Submitted to University",
  "Offer Received",
  "Unconditional Offer",
  "Finance Started",
  "Deposit Confirmed",
  "Finance Complete",
  "CAS Issued",
  "Visa Applied",
  "Enrolled",
  "Withdrawn",
] as const;

type StageName = (typeof TRACKER_STAGES)[number];

function statusToStageIndex(status: AppStatus) {
  if (status === "WITHDRAWN") return 12;
  if (status === "ENROLLED") return 11;
  if (status === "VISA_APPLIED") return 10;
  if (status === "CAS_ISSUED") return 9;
  if (status === "FINANCE_COMPLETE") return 8;
  if (status === "DEPOSIT_PAID") return 7;
  if (status === "FINANCE_IN_PROGRESS") return 6;
  if (status === "UNCONDITIONAL_OFFER") return 5;
  if (status === "CONDITIONAL_OFFER") return 4;
  if (status === "SUBMITTED_TO_UNIVERSITY") return 3;
  if (status === "DOCUMENTS_SUBMITTED") return 2;
  if (status === "DOCUMENTS_PENDING") return 1;
  return 0;
}

function statusToStage(status: string): StageName | null {
  if (status === "APPLIED") return "Application Submitted";
  if (status === "DOCUMENTS_PENDING") return "Documents Requested";
  if (status === "DOCUMENTS_SUBMITTED") return "Documents Verified";
  if (status === "SUBMITTED_TO_UNIVERSITY") return "Submitted to University";
  if (status === "CONDITIONAL_OFFER") return "Offer Received";
  if (status === "UNCONDITIONAL_OFFER") return "Unconditional Offer";
  if (status === "FINANCE_IN_PROGRESS") return "Finance Started";
  if (status === "DEPOSIT_PAID") return "Deposit Confirmed";
  if (status === "FINANCE_COMPLETE") return "Finance Complete";
  if (status === "CAS_ISSUED") return "CAS Issued";
  if (status === "VISA_APPLIED") return "Visa Applied";
  if (status === "ENROLLED") return "Enrolled";
  if (status === "WITHDRAWN") return "Withdrawn";
  return null;
}

function nextStepText(status: AppStatus, visaSubStatus?: DetailPayload["visaSubStatus"]) {
  if (status === "APPLIED") return "Your counsellor will review your application shortly.";
  if (status === "DOCUMENTS_PENDING") return "Please upload your required documents from the Documents tab.";
  if (status === "DOCUMENTS_SUBMITTED") return "Your documents are verified. Your counsellor will submit your application to the university.";
  if (status === "SUBMITTED_TO_UNIVERSITY") return "Your application is with the university. We are waiting for their decision.";
  if (status === "CONDITIONAL_OFFER") return "You have a conditional offer! Review the conditions in the Offer Letter tab.";
  if (status === "UNCONDITIONAL_OFFER") return "Excellent! You have an unconditional offer. Please complete your finance section.";
  if (status === "FINANCE_IN_PROGRESS") return "Please complete your financial documents in the Finance tab.";
  if (status === "DEPOSIT_PAID") return "Your deposit is confirmed. Please complete your remaining financial documents.";
  if (status === "FINANCE_COMPLETE") return "All financial documents complete. Waiting for your CAS letter.";
  if (status === "CAS_ISSUED") return "Your CAS letter is ready. Your counsellor will help you apply for your visa.";
  if (status === "VISA_APPLIED" && visaSubStatus === "VISA_APPROVED") return "Your visa has been approved! Get ready for university.";
  if (status === "VISA_APPLIED" && visaSubStatus === "VISA_REJECTED") return "Unfortunately your visa was refused. Please contact your counsellor immediately.";
  if (status === "VISA_APPLIED") return "Your visa application has been submitted. Waiting for a decision.";
  if (status === "ENROLLED") return "Congratulations! You are now enrolled. Your EduQuantica journey is complete!";
  return "This application has been withdrawn.";
}

function fmtDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-GB");
}

function statusText(status: ChecklistItem["status"]) {
  if (status === "SCANNING") return "Scanning";
  if (status === "REVISION_REQUIRED") return "Revision Required";
  if (status === "VERIFIED") return "Verified";
  if (status === "REJECTED") return "Rejected";
  return "Pending";
}

function statusPill(status: ChecklistItem["status"]) {
  if (status === "VERIFIED") return "bg-emerald-100 text-emerald-700";
  if (status === "SCANNING") return "bg-blue-100 text-blue-700";
  if (status === "REVISION_REQUIRED") return "bg-amber-100 text-amber-700";
  if (status === "REJECTED") return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

function feeBadgeClass(status: DetailPayload["fee"]["displayStatus"]) {
  if (status === "UNPAID") return "bg-rose-100 text-rose-700";
  if (status === "PENDING_APPROVAL") return "bg-amber-100 text-amber-700";
  if (status === "PAID") return "bg-emerald-100 text-emerald-700";
  if (status === "WAIVED") return "bg-blue-100 text-blue-700";
  return "bg-slate-100 text-slate-700";
}

export default function ApplicationTrackerClient({ applicationId }: { applicationId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"timeline" | "documents" | "offer" | "finance" | "scholarships" | "messages">("timeline");
  const [data, setData] = useState<DetailPayload | null>(null);
  const [checklist, setChecklist] = useState<ChecklistPayload | null>(null);
  const [loadingChecklist, setLoadingChecklist] = useState(false);
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const [scholarships, setScholarships] = useState<ScholarshipRow[]>([]);
  const [loadingScholarships, setLoadingScholarships] = useState(false);
  const [savingScholarshipId, setSavingScholarshipId] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ fileName: string; fileUrl: string } | null>(null);
  const [countrySpecificDocs, setCountrySpecificDocs] = useState<CountrySpecificFinanceDoc[]>([]);
  const [loadingCountrySpecificDocs, setLoadingCountrySpecificDocs] = useState(false);
  const [uploadingCountryDocKey, setUploadingCountryDocKey] = useState<string | null>(null);
  const [activeCountryDocKey, setActiveCountryDocKey] = useState<string | null>(null);

  const loadCore = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/student/applications/${applicationId}`, { cache: "no-store" });
      const json = await res.json() as { data?: DetailPayload; error?: string };
      if (!res.ok || !json.data) throw new Error(json.error || "Failed to load application details");
      setData(json.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load application details");
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  const loadChecklist = useCallback(async () => {
    try {
      setLoadingChecklist(true);
      const res = await fetch(`/api/student/applications/${applicationId}/checklist`, { cache: "no-store" });
      const json = await res.json() as { data?: ChecklistPayload; error?: string };
      if (!res.ok || !json.data) throw new Error(json.error || "Failed to load checklist");
      setChecklist(json.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load checklist");
    } finally {
      setLoadingChecklist(false);
    }
  }, [applicationId]);

  const loadScholarships = useCallback(async () => {
    try {
      setLoadingScholarships(true);
      const res = await fetch(`/api/student/applications/${applicationId}/scholarships`, { cache: "no-store" });
      const json = await res.json() as { data?: ScholarshipRow[]; error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to load scholarships");
      setScholarships(json.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load scholarships");
    } finally {
      setLoadingScholarships(false);
    }
  }, [applicationId]);

  const loadCountrySpecificDocs = useCallback(async () => {
    try {
      setLoadingCountrySpecificDocs(true);
      const res = await fetch(`/api/dashboard/applications/${applicationId}/finance`, { cache: "no-store" });
      const json = await res.json() as {
        data?: {
          countrySpecificDocuments?: CountrySpecificFinanceDoc[];
        };
        error?: string;
      };
      if (!res.ok || !json.data) throw new Error(json.error || "Failed to load finance documents");
      setCountrySpecificDocs((json.data.countrySpecificDocuments || []).filter((item) => item.required));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load country-specific documents");
    } finally {
      setLoadingCountrySpecificDocs(false);
    }
  }, [applicationId]);

  useEffect(() => {
    void loadCore();
    void loadChecklist();
    void loadScholarships();
    void loadCountrySpecificDocs();
  }, [loadCore, loadChecklist, loadScholarships, loadCountrySpecificDocs]);

  const stageInfo = useMemo(() => {
    if (!data) return { current: 0, dates: {} as Partial<Record<StageName, string>> };

    const current = statusToStageIndex(data.status);
    const dates: Partial<Record<StageName, string>> = {
      "Application Submitted": data.createdAt,
      "Documents Requested": data.createdAt,
    };

    for (const entry of data.statusHistory) {
      const stage = statusToStage(entry.status);
      if (stage && !dates[stage]) {
        dates[stage] = entry.createdAt;
      }
    }

    if (data.submittedToUniversityAt && !dates["Submitted to University"]) {
      dates["Submitted to University"] = data.submittedToUniversityAt;
    }

    if (data.conditionalOfferAt && !dates["Offer Received"]) {
      dates["Offer Received"] = data.conditionalOfferAt;
    }

    if (data.unconditionalOfferAt && !dates["Unconditional Offer"]) {
      dates["Unconditional Offer"] = data.unconditionalOfferAt;
    }

    if (data.financeCompleteAt && !dates["Finance Complete"]) {
      dates["Finance Complete"] = data.financeCompleteAt;
    }

    if (data.casIssuedAt && !dates["CAS Issued"]) {
      dates["CAS Issued"] = data.casIssuedAt;
    }

    if (data.visaAppliedAt && !dates["Visa Applied"]) {
      dates["Visa Applied"] = data.visaAppliedAt;
    }

    if (data.enrolledAt && !dates.Enrolled) {
      dates.Enrolled = data.enrolledAt;
    }

    if (data.withdrawnAt && !dates.Withdrawn) {
      dates.Withdrawn = data.withdrawnAt;
    }

    return { current, dates };
  }, [data]);

  async function uploadChecklistItem(itemId: string, file: File) {
    try {
      setUploadingItemId(itemId);

      const form = new FormData();
      form.append("files", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: form });
      const uploadJson = await uploadRes.json() as { urls?: string[]; error?: string; message?: string };
      if (!uploadRes.ok || !uploadJson.urls?.[0]) {
        throw new Error(uploadJson.error || "File upload failed");
      }

      const res = await fetch(`/api/student/checklist/${itemId}/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, fileUrl: uploadJson.urls[0] }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to attach document");

      toast.success(uploadJson.message ? `Document uploaded. ${uploadJson.message}` : "Document uploaded. OCR scanning started.");
      await loadChecklist();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload document");
    } finally {
      setUploadingItemId(null);
    }
  }

  async function updateScholarshipStatus(scholarshipId: string, status: "INTERESTED" | "APPLIED") {
    try {
      setSavingScholarshipId(scholarshipId);
      const res = await fetch("/api/student/scholarships/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scholarshipId, status, applicationId }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to update scholarship");

      toast.success(`Scholarship marked as ${status.toLowerCase()}.`);
      await loadScholarships();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update scholarship");
    } finally {
      setSavingScholarshipId(null);
    }
  }

  async function deleteDocument(documentId: string) {
    const confirmed = window.confirm("Are you sure you want to delete this document?");
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/documents/${documentId}`, { method: "DELETE" });
      const json = await res.json() as { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to delete document");

      toast.success("Document deleted successfully.");
      await Promise.all([loadCore(), loadChecklist()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete document");
    }
  }

  async function uploadCountrySpecificDocument(
    key: "PASSPORT" | "ACADEMIC" | "ENGLISH_TEST" | "TB_TEST" | "POST_STUDY_PLAN",
    file: File,
  ) {
    try {
      setUploadingCountryDocKey(key);

      const form = new FormData();
      form.append("files", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: form });
      const uploadJson = await uploadRes.json() as { urls?: string[]; error?: string; message?: string };
      if (!uploadRes.ok || !uploadJson.urls?.[0]) {
        throw new Error(uploadJson.error || "File upload failed");
      }

      const res = await fetch(`/api/dashboard/applications/${applicationId}/finance/general-documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, fileName: file.name, fileUrl: uploadJson.urls[0] }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to upload document");

      toast.success(uploadJson.message ? `Document uploaded. ${uploadJson.message}` : "Document uploaded.");
      setActiveCountryDocKey(null);
      await Promise.all([loadChecklist(), loadCountrySpecificDocs()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload document");
    } finally {
      setUploadingCountryDocKey(null);
    }
  }

  if (loading) {
    return <main className="w-full px-5 py-6 sm:px-7"><div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading application...</div></main>;
  }

  if (error || !data) {
    return <main className="w-full px-5 py-6 sm:px-7"><div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{error || "Application not found"}</div></main>;
  }

  const statusMeta = STATUS_UI[data.status];

  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const pct = (checklist?.completionPct || 0) / 100;
  const strokeOffset = circumference * (1 - pct);

  return (
    <main className="w-full space-y-5 px-5 py-6 sm:px-7">
      <Link href="/student/applications" className="text-sm font-medium text-blue-700 hover:underline">← Back to Applications</Link>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {data.university.logo ? (
              <Image
                src={data.university.logo}
                alt={data.university.name}
                width={64}
                height={64}
                className="h-16 w-16 rounded-xl object-cover"
                loader={({ src }) => src}
                unoptimized
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-slate-100 text-base font-semibold text-slate-600">
                {data.university.name.slice(0, 2).toUpperCase()}
              </div>
            )}

            <div>
              <h1 className="text-xl font-bold text-slate-900">{data.university.name}</h1>
              <p className="text-sm text-slate-700">{data.course.name}</p>
              <p className="mt-1 text-xs text-slate-500">Intake: {data.intake?.date || "To be confirmed"}</p>
              <p className="text-xs text-slate-500">Application ID: {data.id}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`rounded-full px-4 py-2 text-sm font-semibold ${statusMeta.badge}`}>{statusMeta.label}</span>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${feeBadgeClass(data.fee.displayStatus)}`}>
              Fee: {data.fee.displayStatus.replace("_", " ")}
            </span>
          </div>
        </div>
      </section>

      <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <div className="flex min-w-[860px] border-b border-slate-200 px-4">
          {[
            { key: "timeline", label: "Progress Timeline" },
            { key: "documents", label: "Documents" },
            { key: "offer", label: "Offer Letter" },
            { key: "finance", label: "Finance" },
            { key: "scholarships", label: "Scholarships" },
            { key: "messages", label: "Messages" },
          ].map((tab) => {
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`border-b-2 px-4 py-3 text-sm font-semibold transition ${
                  activeTab === tab.key
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-5">
          {activeTab === "timeline" && (
            <section className="space-y-5">
              {data.status === "WITHDRAWN" && (
                <div className="rounded-xl border border-slate-300 bg-slate-100 p-4 text-sm text-slate-700">
                  This application has been withdrawn. Please contact your counsellor if you want to restart.
                </div>
              )}
              {data.status === "VISA_APPLIED" && data.visaSubStatus === "VISA_REJECTED" && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                  Unfortunately your visa was refused.
                  {data.visaRejectionReason ? ` Reason: ${data.visaRejectionReason}` : ""}
                </div>
              )}

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="space-y-0">
                  {TRACKER_STAGES.map((stage, index) => {
                    const done = index < stageInfo.current;
                    const current = index === stageInfo.current;

                    return (
                      <div key={stage} className="flex gap-4">
                        <div className="flex w-10 flex-col items-center">
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                              done
                                ? "border-blue-600 bg-blue-600 text-white"
                                : current
                                  ? "border-amber-500 bg-amber-100 text-amber-800 animate-pulse"
                                  : "border-slate-300 bg-slate-100 text-slate-500"
                            }`}
                          >
                            {done ? <Check className="h-5 w-5" /> : index + 1}
                          </div>
                          {index < TRACKER_STAGES.length - 1 && (
                            <div className={`h-10 w-0.5 ${index < stageInfo.current ? "bg-blue-600" : "bg-slate-200"}`} />
                          )}
                        </div>

                        <div className="pb-6 pt-1">
                          <p className={`text-sm font-semibold ${current ? "text-amber-700" : "text-slate-900"}`}>{stage}</p>
                          <p className="text-xs text-slate-500">{fmtDate(stageInfo.dates[stage])}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <ApplicationInterviewTracking applicationId={data.id} roleName="STUDENT" />

              {data.fee.feeRequired && data.fee.displayStatus !== "PAID" && data.fee.displayStatus !== "WAIVED" && (
                <div>
                  <Link
                    href={`/student/applications/${data.id}/fee`}
                    className="inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Pay Application Fee
                  </Link>
                </div>
              )}

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                {nextStepText(data.status, data.visaSubStatus)}
              </div>
            </section>
          )}

          {activeTab === "documents" && (
            <section className="space-y-5">
              {/* Conditional offer requirements */}
              {data.status === "CONDITIONAL_OFFER" && data.offerConditions && (() => {
                const conditions = data.offerConditions
                  .split(/\n?\s*\d+[\.\)]\s+/)
                  .filter(Boolean)
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .length > 1
                  ? data.offerConditions.split(/\n?\s*\d+[\.\)]\s+/).filter(Boolean).map((s) => s.trim()).filter(Boolean)
                  : data.offerConditions.split("\n").map((s) => s.trim()).filter(Boolean);
                return conditions.length > 0 ? (
                  <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
                    <div className="flex items-start gap-2 mb-3">
                      <span className="text-lg">⚠️</span>
                      <div>
                        <h3 className="text-sm font-bold text-amber-900">Conditional Offer — Documents Required</h3>
                        <p className="text-xs text-amber-700 mt-0.5">Upload supporting documents for each condition listed below.</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {conditions.map((condition, idx) => (
                        <div key={idx} className="rounded-lg border border-amber-200 bg-white p-3">
                          <div className="flex items-start gap-2">
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">
                              {idx + 1}
                            </span>
                            <p className="text-sm text-slate-800">{condition}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-amber-700">
                      Upload your documents using the <strong>Upload</strong> button in the Milestone Documents or checklist sections below. Your counsellor will review and verify them.
                    </p>
                  </div>
                ) : null;
              })()}

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-900">Milestone Documents</h3>
                <p className="mt-1 text-xs text-slate-500">Track completion across Application Submission, Offer Letter, Finance, CAS, and Visa.</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {data.milestones.map((item) => (
                    <article key={item.id} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-slate-900">{item.title}</p>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          item.status === "VERIFIED"
                            ? "bg-emerald-100 text-emerald-700"
                            : item.status === "UPLOADED"
                              ? "bg-blue-100 text-blue-700"
                              : item.status === "REJECTED"
                                ? "bg-rose-100 text-rose-700"
                                : "bg-slate-100 text-slate-700"
                        }`}>
                          {item.status}
                        </span>
                      </div>
                      {item.fileUrl ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setPreviewDoc({ fileName: item.fileName || item.title, fileUrl: toApiFilesPath(item.fileUrl as string) })}
                            className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                          >
                            Preview
                          </button>
                          <a
                            href={toApiFilesDownloadPath(item.fileUrl)}
                            className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                          >
                            Download
                          </a>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-slate-500">No file uploaded yet.</p>
                      )}
                    </article>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-900">Country-Specific Visa Documents</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Upload these required documents here based on your destination country.
                </p>

                {loadingCountrySpecificDocs ? (
                  <p className="mt-3 text-sm text-slate-600">Loading country-specific documents...</p>
                ) : countrySpecificDocs.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-600">No country-specific items found for this application.</p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {countrySpecificDocs.map((item) => {
                      const isDone = item.status === "DONE";
                      const isBankStatement = item.key === "BANK_STATEMENT";

                      return (
                        <article key={item.key} className="rounded-lg border border-slate-200 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-medium text-slate-900">{item.label}</p>
                            <button
                              type="button"
                              onClick={() => {
                                if (isDone) return;
                                if (isBankStatement) {
                                  setActiveTab("finance");
                                  return;
                                }
                                setActiveCountryDocKey((prev) => (prev === item.key ? null : item.key));
                              }}
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                isDone
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                              }`}
                            >
                              {isDone ? "Done" : "To Do"}
                            </button>
                          </div>

                          {!isDone && isBankStatement && (
                            <p className="mt-2 text-xs text-slate-500">Upload and approve bank statements from the Finance tab.</p>
                          )}

                          {!isDone && !isBankStatement && activeCountryDocKey === item.key && (
                            <div className="mt-3">
                              <ChecklistUploadZone
                                compact
                                uploading={uploadingCountryDocKey === item.key}
                                checklistItemId={item.checklistItemId || undefined}
                                studentId={data.student.id}
                                checklistItemName={item.label}
                                onMobileUploadCompleted={() => {
                                  void Promise.all([loadChecklist(), loadCountrySpecificDocs()]);
                                }}
                                onFileSelected={async (file) => {
                                  await uploadCountrySpecificDocument(item.key as "PASSPORT" | "ACADEMIC" | "ENGLISH_TEST" | "TB_TEST" | "POST_STUDY_PLAN", file);
                                }}
                              />
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>

              {loadingChecklist ? (
                <div className="text-sm text-slate-600">Loading checklist...</div>
              ) : !checklist ? (
                <div className="text-sm text-slate-600">Checklist unavailable.</div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="relative h-28 w-28">
                      <svg viewBox="0 0 100 100" className="h-28 w-28">
                        <circle cx="50" cy="50" r={radius} stroke="#E2E8F0" strokeWidth="10" fill="none" />
                        <circle
                          cx="50"
                          cy="50"
                          r={radius}
                          stroke="#2563EB"
                          strokeWidth="10"
                          fill="none"
                          strokeLinecap="round"
                          transform="rotate(-90 50 50)"
                          strokeDasharray={circumference}
                          strokeDashoffset={strokeOffset}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <p className="text-sm font-bold text-slate-900">{checklist.verifiedCount}/{checklist.totalCount}</p>
                        <p className="text-[10px] text-slate-500">Verified</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Document progress</p>
                      <p className="text-sm text-slate-600">{checklist.completionPct}% complete</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {checklist.items.length === 0 ? (
                      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">No checklist items for this application yet.</div>
                    ) : (
                      checklist.items.map((item) => (
                        <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-900">{item.label}</p>
                              <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusPill(item.status)}`}>
                                {statusText(item.status)}
                              </span>
                              {item.reason && <p className="mt-2 text-xs text-rose-700">{item.reason}</p>}
                              {item.fileUrl && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setPreviewDoc({
                                      fileName: item.fileName || "Document",
                                      fileUrl: toApiFilesPath(item.fileUrl),
                                    })}
                                    className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                  >
                                    Preview
                                  </button>
                                  <a
                                    href={toApiFilesDownloadPath(item.fileUrl)}
                                    className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                  >
                                    Download
                                  </a>
                                  {item.documentId && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        void deleteDocument(item.documentId as string);
                                      }}
                                      className="rounded-md border border-rose-300 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
                                    >
                                      Delete
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="w-full max-w-md">
                              <ChecklistUploadZone
                                compact
                                uploading={uploadingItemId === item.id}
                                checklistItemId={item.id}
                                studentId={data.student.id}
                                checklistItemName={item.label}
                                onMobileUploadCompleted={() => {
                                  void loadChecklist();
                                }}
                                onFileSelected={async (file) => {
                                  await uploadChecklistItem(item.id, file);
                                }}
                              />
                            </div>
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </>
              )}
            </section>
          )}

          {activeTab === "offer" && (
            <section>
              {!data.offerReceivedAt ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
                  <Lock className="mx-auto h-8 w-8 text-slate-400" />
                  <p className="mt-3 text-sm text-slate-600">You will be able to view your offer letter here once received.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-sm font-semibold text-slate-900">Offer Letter Document</p>
                    {data.offerLetter?.fileUrl ? (
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-slate-600">{data.offerLetter.fileName || "Offer letter"}</p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setPreviewDoc({
                              fileName: data.offerLetter?.fileName || "Offer Letter",
                              fileUrl: toApiFilesPath(data.offerLetter?.fileUrl),
                            })}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Preview
                          </button>
                          <a
                            href={toApiFilesDownloadPath(data.offerLetter.fileUrl)}
                            className="rounded-lg bg-[#1E3A5F] px-3 py-2 text-xs font-semibold text-white hover:opacity-95"
                          >
                            Download
                          </a>
                          {data.offerLetter.documentId && (
                            <button
                              type="button"
                              onClick={() => {
                                void deleteDocument(data.offerLetter?.documentId as string);
                              }}
                              className="rounded-lg border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-slate-600">Details will appear after offer letter is processed.</p>
                    )}
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-sm font-semibold text-slate-900">Extracted Offer Details</p>
                    <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">University name</p>
                        <p>Details will appear after offer letter is processed.</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">Course name</p>
                        <p>Details will appear after offer letter is processed.</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">Intake</p>
                        <p>Details will appear after offer letter is processed.</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">Fees</p>
                        {data.offerLetter?.ocr?.courseFee != null ? (
                          <p>
                            {data.offerLetter.ocr.currency || ""} {data.offerLetter.ocr.courseFee.toLocaleString()}
                            {data.offerLetter.ocr.scholarship != null && ` (Scholarship: ${data.offerLetter.ocr.currency || ""} ${data.offerLetter.ocr.scholarship.toLocaleString()})`}
                          </p>
                        ) : (
                          <p>Details will appear after offer letter is processed.</p>
                        )}
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3 sm:col-span-2">
                        <p className="text-xs text-slate-500">Any conditions</p>
                        <p>{data.offerConditions || "No additional conditions shared yet."}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {activeTab === "finance" && (
            <section>
              <ApplicationFinanceTab
                applicationId={data.id}
                userRole="STUDENT"
                studentNationality={data.student.nationality}
                applicationStatus={data.status}
              />
            </section>
          )}

          {activeTab === "scholarships" && (
            <section className="space-y-3">
              {loadingScholarships ? (
                <div className="text-sm text-slate-600">Loading scholarships...</div>
              ) : scholarships.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">No scholarships linked to this application yet.</div>
              ) : (
                scholarships.map((item) => (
                  <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{item.name}</p>
                        <p className="text-xs text-slate-500">{item.isPartial ? "Partial" : "Full"} • Deadline: {fmtDate(item.deadline)}</p>
                        <p className="mt-1 text-xs text-slate-600">{item.eligibilityCriteria}</p>
                        <p className="mt-1 text-xs font-medium text-slate-700">
                          {item.amountType === "FIXED"
                            ? `${item.currency} ${item.amount.toLocaleString()}`
                            : `${item.amount}% (${item.percentageOf || "TOTAL"})`}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          {item.currentStatus || "Not selected"}
                        </span>
                        {item.currentStatus === "AWARDED" && item.awardedAmount != null && (
                          <p className="text-xs font-medium text-emerald-700">Awarded: {item.awardedAmount.toLocaleString()} {item.currency}</p>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => void updateScholarshipStatus(item.id, "INTERESTED")}
                            disabled={savingScholarshipId === item.id}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                          >
                            I am Interested
                          </button>
                          <button
                            onClick={() => void updateScholarshipStatus(item.id, "APPLIED")}
                            disabled={savingScholarshipId === item.id}
                            className="rounded-lg bg-[#1E3A5F] px-3 py-2 text-xs font-semibold text-white hover:opacity-95 disabled:opacity-60"
                          >
                            Applied
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </section>
          )}

          {activeTab === "messages" && (
            <section className="h-[580px]">
              <div className="mb-3 flex items-center gap-2 text-sm text-slate-700">
                <MessageSquare className="h-4 w-4" />
                Application messages with your counsellor
              </div>
              <MessagesThread studentId={data.student.id} />
            </section>
          )}
        </div>
      </section>

      {previewDoc && (
        <DocumentPreviewModal
          fileUrl={previewDoc.fileUrl}
          fileName={previewDoc.fileName}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </main>
  );
}
