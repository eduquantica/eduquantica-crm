"use client";

import { useCallback, useEffect, useState } from "react";
import { Session } from "next-auth";
import {
  ArrowLeft,
  Clock,
  FileText,
  MessageSquare,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessagesThread } from "@/components/MessagesThread";
import CurrencyDisplay from "@/components/CurrencyDisplay";
import StudyGapIndicator from "@/components/ui/StudyGapIndicator";
import ApplicationOfferLetterTab from "./ApplicationOfferLetterTab";
import ApplicationFinanceTab from "./ApplicationFinanceTab";
import ApplicationInterviewTracking from "@/components/ApplicationInterviewTracking";
import MockInterviewTab from "@/components/MockInterviewTab";
import DocumentPreviewModal from "@/components/shared/DocumentPreviewModal";
import { toApiFilesDownloadPath, toApiFilesPath } from "@/lib/file-url";
import {
  APPLICATION_PIPELINE,
  APPLICATION_STATUS_BADGES,
  APPLICATION_STATUS_LABELS,
  COUNSELLOR_ALLOWED_STATUSES,
  VISA_SUB_STATUS_LABELS,
} from "@/lib/application-pipeline";

interface Application {
  id: string;
  status: string;
  createdAt: Date;
  submittedAt: Date | null;
  offerReceivedAt?: Date | null;
  visaSubStatus?: "VISA_PENDING" | "VISA_APPROVED" | "VISA_REJECTED" | null;
  visaRejectionReason?: string | null;
  offerConditions?: string | null;
  casNumber?: string | null;
  visaApplicationRef?: string | null;
  visaVignetteRef?: string | null;
  withdrawalReason?: string | null;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    nationality?: string | null;
    studyGapIndicator: {
      colour: "GREEN" | "YELLOW" | "RED";
      gapYears: number;
      lastQualification: string;
    };
    assignedCounsellorId: string | null;
    assignedCounsellor: { id: string; name: string | null; email: string } | null;
    subAgent: { id: string; agencyName: string; userId: string; user: { email: string } } | null;
  };
  course: {
    id: string;
    name: string;
    level: string;
    tuitionFee?: number | null;
    currency?: string | null;
    university: {
      id: string;
      name: string;
    };
    intakeDatesWithDeadlines: unknown;
  };
  counsellor: { id: string; name: string | null; email: string } | null;
  statusHistory: Array<{
    id: string;
    status: string;
    createdAt: Date;
    notes: string | null;
    changedBy: { id: string; name: string | null; email: string };
  }>;
  documents: Array<{
    id: string;
    fileName: string;
    fileUrl: string;
    type: string;
    status: string;
  }>;
  fee: {
    feeRequired: boolean;
    displayStatus: "UNPAID" | "PENDING_APPROVAL" | "PAID" | "WAIVED" | "NOT_REQUIRED";
    amount: number;
    currency: string;
    feeType: "UCAS_SINGLE" | "UCAS_MULTIPLE" | "UNIVERSITY_DIRECT" | null;
  };
}

type MilestoneDocument = {
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
};

interface ApplicationDetailClientProps {
  application: Application;
  session: Session;
  userRole: string;
}

const STATUS_COLORS: Record<string, string> = APPLICATION_STATUS_BADGES;

const STATUS_LABELS: Record<string, string> = APPLICATION_STATUS_LABELS;

const ALL_STATUSES = APPLICATION_PIPELINE;
const COUNSELLOR_STATUSES = COUNSELLOR_ALLOWED_STATUSES;

const VISA_TRACKING_VISIBLE_STATUSES = [
  "VISA_APPLIED",
  "ENROLLED",
  "WITHDRAWN",
];

export default function ApplicationDetailClient({
  application: initialApp,
  userRole,
}: ApplicationDetailClientProps) {
  const queryClient = useQueryClient();
  const [application, setApplication] = useState(initialApp);
  const [activeTab, setActiveTab] = useState("timeline");
  const [showStatusForm, setShowStatusForm] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [statusNotes, setStatusNotes] = useState("");
  const [offerConditions, setOfferConditions] = useState("");
  const [casNumber, setCasNumber] = useState("");
  const [visaApplicationRef, setVisaApplicationRef] = useState("");
  const [visaVignetteRef, setVisaVignetteRef] = useState("");
  const [visaSubStatus, setVisaSubStatus] = useState<"VISA_PENDING" | "VISA_APPROVED" | "VISA_REJECTED">("VISA_PENDING");
  const [visaRejectionReason, setVisaRejectionReason] = useState("");
  const [withdrawalReason, setWithdrawalReason] = useState("");
  const [offerLetterFile, setOfferLetterFile] = useState<File | null>(null);
  const [showEnrolmentModal, setShowEnrolmentModal] = useState(false);
  const [enrolmentPreview, setEnrolmentPreview] = useState<{
    studentName: string;
    university: string;
    course: string;
    tuitionFee: number;
    currency: string;
    universityRate: number;
    estimated: {
      grossCommission: number;
      agentRate: number;
      agentAmount: number;
      eduquanticaNet: number;
    };
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [certificateInfo, setCertificateInfo] = useState<{
    checklistId: string | null;
    allVerified: boolean;
    signedPdfUrl: string | null;
    verificationRef: string | null;
  } | null>(null);
  const [certificateGenerating, setCertificateGenerating] = useState(false);
  const [showPayOnBehalfModal, setShowPayOnBehalfModal] = useState(false);
  const [payOnBehalfMethod, setPayOnBehalfMethod] = useState<"CASH_RECEIVED" | "BANK_TRANSFER" | "WAIVED">("BANK_TRANSFER");
  const [payOnBehalfRef, setPayOnBehalfRef] = useState("");
  const [payOnBehalfReceipt, setPayOnBehalfReceipt] = useState<string>("");
  const [processingFeeAction, setProcessingFeeAction] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{ fileName: string; fileUrl: string } | null>(null);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [milestoneDocs, setMilestoneDocs] = useState<MilestoneDocument[]>([]);
  const [milestonesLoading, setMilestonesLoading] = useState(false);
  const [milestoneActionId, setMilestoneActionId] = useState<string | null>(null);

  const canChangeStatus = userRole === "ADMIN" || userRole === "MANAGER" || userRole === "COUNSELLOR";
  const canEnrol = userRole === "ADMIN" || userRole === "MANAGER";
  const canGenerateCertificate = userRole === "ADMIN" || userRole === "COUNSELLOR";
  const canPayOnBehalf = userRole === "COUNSELLOR" || userRole === "SUB_AGENT" || userRole === "ADMIN" || userRole === "MANAGER";
  const canApproveWaiver = userRole === "ADMIN" || userRole === "MANAGER";
  const canDeleteDocuments = userRole === "ADMIN" || userRole === "MANAGER" || userRole === "COUNSELLOR";
  const showVisaTrackingButton = VISA_TRACKING_VISIBLE_STATUSES.includes(application.status);
  const statusOptions = userRole === "COUNSELLOR" ? COUNSELLOR_STATUSES : ALL_STATUSES;

  const feeBadgeClass = (() => {
    if (application.fee.displayStatus === "UNPAID") return "bg-rose-100 text-rose-700";
    if (application.fee.displayStatus === "PENDING_APPROVAL") return "bg-amber-100 text-amber-700";
    if (application.fee.displayStatus === "PAID") return "bg-emerald-100 text-emerald-700";
    if (application.fee.displayStatus === "WAIVED") return "bg-blue-100 text-blue-700";
    return "bg-slate-100 text-slate-700";
  })();

  async function refreshFeeStatus() {
    const res = await fetch(`/api/dashboard/applications/${application.id}/fee`, { cache: "no-store" });
    const json = await res.json() as { data?: { fee?: Application["fee"] }; error?: string };
    if (!res.ok || !json.data?.fee) throw new Error(json.error || "Failed to refresh fee status");
    setApplication((prev) => ({ ...prev, fee: json.data!.fee! }));
  }

  async function deleteDocument(documentId: string) {
    const confirmed = window.confirm("Are you sure you want to delete this document?");
    if (!confirmed) return;

    try {
      setDeletingDocId(documentId);
      const res = await fetch(`/api/documents/${documentId}`, { method: "DELETE" });
      const json = await res.json() as { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to delete document");

      setApplication((prev) => ({
        ...prev,
        documents: prev.documents.filter((doc) => doc.id !== documentId),
      }));
      toast.success("Document deleted successfully.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete document");
    } finally {
      setDeletingDocId(null);
    }
  }

  async function uploadPayOnBehalfReceipt(file: File) {
    const formData = new FormData();
    formData.append("files", file);
    const uploadRes = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });
    const uploadJson = await uploadRes.json() as { urls?: string[]; error?: string };
    if (!uploadRes.ok || !uploadJson.urls?.[0]) throw new Error(uploadJson.error || "Receipt upload failed");
    setPayOnBehalfReceipt(uploadJson.urls[0]);
    toast.success("Receipt uploaded");
  }

  const loadMilestones = useCallback(async () => {
    try {
      setMilestonesLoading(true);
      const res = await fetch(`/api/dashboard/applications/${application.id}/milestones`, { cache: "no-store" });
      const json = await res.json() as { data?: MilestoneDocument[]; error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to load milestone documents");
      setMilestoneDocs(json.data || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load milestone documents");
    } finally {
      setMilestonesLoading(false);
    }
  }, [application.id]);

  async function uploadMilestoneFile(milestone: MilestoneDocument, file: File) {
    try {
      setMilestoneActionId(milestone.id);
      const formData = new FormData();
      formData.append("files", file);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const uploadJson = await uploadRes.json() as { urls?: string[]; error?: string; message?: string };
      if (!uploadRes.ok || !uploadJson.urls?.[0]) {
        throw new Error(uploadJson.error || "Upload failed");
      }

      const saveRes = await fetch(`/api/dashboard/applications/${application.id}/milestones`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          milestone: milestone.milestone,
          fileName: file.name,
          fileUrl: uploadJson.urls[0],
          status: "UPLOADED",
        }),
      });
      const saveJson = await saveRes.json() as { error?: string };
      if (!saveRes.ok) throw new Error(saveJson.error || "Failed to save milestone file");

      toast.success(uploadJson.message ? `Milestone document saved. ${uploadJson.message}` : "Milestone document saved.");
      await loadMilestones();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload milestone file");
    } finally {
      setMilestoneActionId(null);
    }
  }

  async function updateMilestoneStatus(milestone: MilestoneDocument, status: "VERIFIED" | "REJECTED") {
    try {
      setMilestoneActionId(milestone.id);
      const res = await fetch(`/api/dashboard/applications/${application.id}/milestones`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ milestone: milestone.milestone, status }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to update milestone");
      toast.success(`Milestone marked as ${status.toLowerCase()}.`);
      await loadMilestones();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update milestone");
    } finally {
      setMilestoneActionId(null);
    }
  }

  async function clearMilestoneFile(milestone: MilestoneDocument) {
    try {
      setMilestoneActionId(milestone.id);
      const res = await fetch(`/api/dashboard/applications/${application.id}/milestones?milestone=${milestone.milestone}`, {
        method: "DELETE",
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to clear milestone");
      toast.success("Milestone document cleared.");
      await loadMilestones();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to clear milestone");
    } finally {
      setMilestoneActionId(null);
    }
  }

  async function submitPayOnBehalf() {
    try {
      setProcessingFeeAction(true);
      const res = await fetch(`/api/dashboard/applications/${application.id}/fee`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "payOnBehalf",
          paymentMethod: payOnBehalfMethod,
          paymentRef: payOnBehalfRef || undefined,
          receiptUrl: payOnBehalfReceipt || undefined,
        }),
      });
      const json = await res.json() as { data?: { fee?: Application["fee"] }; error?: string };
      if (!res.ok || !json.data?.fee) throw new Error(json.error || "Failed to record fee payment");
      setApplication((prev) => ({ ...prev, fee: json.data!.fee! }));
      setShowPayOnBehalfModal(false);
      setPayOnBehalfMethod("BANK_TRANSFER");
      setPayOnBehalfRef("");
      setPayOnBehalfReceipt("");
      toast.success(payOnBehalfMethod === "WAIVED" ? "Waiver request submitted for manager approval" : "Fee paid on behalf of student");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to record fee payment");
    } finally {
      setProcessingFeeAction(false);
    }
  }

  async function approveFeePayment(action: "approvePayment" | "approveWaiver") {
    try {
      setProcessingFeeAction(true);
      const res = await fetch(`/api/dashboard/applications/${application.id}/fee`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json() as { data?: { fee?: Application["fee"] }; error?: string };
      if (!res.ok || !json.data?.fee) throw new Error(json.error || "Failed to update fee status");
      setApplication((prev) => ({ ...prev, fee: json.data!.fee! }));
      toast.success(action === "approveWaiver" ? "Fee waiver approved" : "Fee payment approved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update fee status");
    } finally {
      setProcessingFeeAction(false);
    }
  }

  const updateStatusMutation = useMutation({
    mutationFn: async () => {
      if (!newStatus) throw new Error("Please select a status");

      let offerLetterFileUrl: string | undefined;
      let offerLetterFileName: string | undefined;
      let uploadMessage: string | undefined;
      if (newStatus === "UNCONDITIONAL_OFFER" && offerLetterFile) {
        const uploadFormData = new FormData();
        uploadFormData.append("files", offerLetterFile);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: uploadFormData });
        const uploadJson = (await uploadRes.json()) as { urls?: string[]; error?: string; message?: string };
        if (!uploadRes.ok || !uploadJson.urls?.[0]) {
          throw new Error(uploadJson.error || "Offer letter upload failed");
        }
        offerLetterFileUrl = uploadJson.urls[0];
        offerLetterFileName = offerLetterFile.name;
        uploadMessage = uploadJson.message;
      }

      const res = await fetch(
        `/api/dashboard/applications/${application.id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: newStatus,
            notes: statusNotes || undefined,
            offerConditions: offerConditions || undefined,
            casNumber: casNumber || undefined,
            visaApplicationRef: visaApplicationRef || undefined,
            visaVignetteRef: visaVignetteRef || undefined,
            visaSubStatus: newStatus === "VISA_APPLIED" ? visaSubStatus : undefined,
            visaRejectionReason: visaSubStatus === "VISA_REJECTED" ? visaRejectionReason || undefined : undefined,
            withdrawalReason: newStatus === "WITHDRAWN" ? withdrawalReason || undefined : undefined,
            offerLetterFileName,
            offerLetterFileUrl,
          }),
        }
      );

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update status");
      }

      return {
        ...(await res.json()),
        uploadMessage,
      };
    },
    onSuccess: (data) => {
      setApplication((prev) => ({
        ...data.data,
        fee: prev.fee,
      }));
      toast.success(data.uploadMessage
        ? `Application status updated to ${STATUS_LABELS[newStatus]}. ${data.uploadMessage}`
        : `Application status updated to ${STATUS_LABELS[newStatus]}`);
      setShowStatusForm(false);
      setNewStatus("");
      setStatusNotes("");
      setOfferConditions("");
      setCasNumber("");
      setVisaApplicationRef("");
      setVisaVignetteRef("");
      setVisaSubStatus("VISA_PENDING");
      setVisaRejectionReason("");
      setWithdrawalReason("");
      setOfferLetterFile(null);
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update status");
    },
  });

  const handleOpenEnrolmentModal = async () => {
    setShowEnrolmentModal(true);
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/dashboard/applications/${application.id}/enrolment-confirm`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load commission preview");
      setEnrolmentPreview(json.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load commission preview");
      setShowEnrolmentModal(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleConfirmEnrolment = async () => {
    try {
      const res = await fetch(`/api/dashboard/applications/${application.id}/enrolment-confirm`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to confirm enrolment");

      setApplication((prev) => ({ ...prev, status: "ENROLLED" }));
      toast.success("Enrolment confirmed and commission calculated");
      setShowEnrolmentModal(false);
      setEnrolmentPreview(null);
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to confirm enrolment");
    }
  };

  const nextIntake =
    (Array.isArray(application.course.intakeDatesWithDeadlines)
      ? (application.course.intakeDatesWithDeadlines as Array<{ date?: string }>)?.[0]?.date
      : null) || "-";

  useEffect(() => {
    let mounted = true;

    async function loadCertificate() {
      try {
        const res = await fetch(`/api/dashboard/applications/${application.id}/checklist-certificate`);
        if (!res.ok) return;
        const json = await res.json();
        if (mounted) setCertificateInfo(json.data || null);
      } catch {
        // ignore certificate widget failure
      }
    }

    loadCertificate();
    return () => {
      mounted = false;
    };
  }, [application.id]);

  useEffect(() => {
    if (activeTab !== "documents") return;
    void loadMilestones();
  }, [activeTab, loadMilestones]);

  const handleGenerateCertificate = async () => {
    if (!certificateInfo?.checklistId) return;

    setCertificateGenerating(true);
    try {
      const res = await fetch(`/api/admin/checklists/${certificateInfo.checklistId}/generate-certificate`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to generate certificate");

      setCertificateInfo((prev) =>
        prev
          ? {
              ...prev,
              signedPdfUrl: json.data?.signedPdfUrl || prev.signedPdfUrl,
              verificationRef: json.data?.verificationRef || prev.verificationRef,
            }
          : prev,
      );
      toast.success("Verified certificate generated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate certificate");
    } finally {
      setCertificateGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto p-6">
          <div className="flex items-center gap-4 mb-4">
            <Link
              href="/dashboard/applications"
              className="text-blue-600 hover:underline flex items-center gap-1 text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Applications
            </Link>
            {showVisaTrackingButton && (
              <Link
                href={`/dashboard/visa/${application.id}`}
                className="ml-auto inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                View Visa Tracking
              </Link>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* App ID */}
            <div>
              <p className="text-xs text-gray-500 uppercase">Application ID</p>
              <p className="text-lg font-semibold text-gray-900">{application.id}</p>
            </div>

            {/* Student */}
            <div>
              <p className="text-xs text-gray-500 uppercase">Student</p>
              <div className="flex items-center gap-2">
                <Link
                  href={`/dashboard/students/${application.student.id}`}
                  className="text-lg font-semibold text-blue-600 hover:underline"
                >
                  {application.student.firstName} {application.student.lastName}
                </Link>
                <StudyGapIndicator colour={application.student.studyGapIndicator.colour} size="md" />
              </div>
            </div>

            {/* University & Course */}
            <div>
              <p className="text-xs text-gray-500 uppercase">University & Course</p>
              <p className="text-sm font-semibold text-gray-900">
                {application.course.university.name}
              </p>
              <p className="text-xs text-gray-600">{application.course.name}</p>
              {typeof application.course.tuitionFee === "number" && (
                <div className="mt-2">
                  <CurrencyDisplay
                    amount={application.course.tuitionFee}
                    baseCurrency={application.course.currency || "GBP"}
                  />
                </div>
              )}
            </div>

            {/* Status & Info */}
            <div>
              <p className="text-xs text-gray-500 uppercase">Status & Intake</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    STATUS_COLORS[application.status] || "bg-gray-100 text-gray-800"
                  }`}
                >
                  {STATUS_LABELS[application.status] || application.status}
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${feeBadgeClass}`}>
                  Fee: {application.fee.displayStatus.replace("_", " ")}
                </span>
                {application.status === "VISA_APPLIED" && application.visaSubStatus && (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                    Visa: {VISA_SUB_STATUS_LABELS[application.visaSubStatus]}
                  </span>
                )}
                {application.student.subAgent && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded font-medium">
                    {application.student.subAgent.agencyName}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600 mt-1">Intake: {nextIntake}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto">
        <div className="bg-white border-b border-gray-200 overflow-x-auto">
          <div className="flex gap-8 px-6 py-0">
            <button
              onClick={() => setActiveTab("timeline")}
              className={`py-4 px-0 border-b-2 font-medium transition ${
                activeTab === "timeline"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              <Clock className="w-4 h-4 inline mr-2" />
              Status Timeline
            </button>
            <button
              onClick={() => setActiveTab("documents")}
              className={`py-4 px-0 border-b-2 font-medium transition ${
                activeTab === "documents"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              <FileText className="w-4 h-4 inline mr-2" />
              Document Checklist
            </button>
            <button
              onClick={() => setActiveTab("requirements")}
              className={`py-4 px-0 border-b-2 font-medium transition ${
                activeTab === "requirements"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              <AlertCircle className="w-4 h-4 inline mr-2" />
              Entry Requirements
            </button>
            <button
              onClick={() => setActiveTab("communications")}
              className={`py-4 px-0 border-b-2 font-medium transition ${
                activeTab === "communications"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              <MessageSquare className="w-4 h-4 inline mr-2" />
              Communications
            </button>
            <button
              onClick={() => setActiveTab("offer")}
              className={`py-4 px-0 border-b-2 font-medium transition ${
                activeTab === "offer"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              <FileText className="w-4 h-4 inline mr-2" />
              Offer Letter
            </button>
            <button
              onClick={() => setActiveTab("finance")}
              className={`py-4 px-0 border-b-2 font-medium transition ${
                activeTab === "finance"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              <FileText className="w-4 h-4 inline mr-2" />
              Finance
            </button>
            <button
              onClick={() => setActiveTab("mock-interview")}
              className={`py-4 px-0 border-b-2 font-medium transition ${
                activeTab === "mock-interview"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              <MessageSquare className="w-4 h-4 inline mr-2" />
              Mock Interview
            </button>
            {userRole === "ADMIN" && (
              <button
                onClick={() => setActiveTab("commission")}
                className={`py-4 px-0 border-b-2 font-medium transition ${
                  activeTab === "commission"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
              >
                <FileText className="w-4 h-4 inline mr-2" />
                Commission
              </button>
            )}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Status Timeline */}
          {activeTab === "timeline" && (
            <div className="space-y-6">
              {/* Status Change Form */}
              {canChangeStatus && !showStatusForm && (
                <button
                  onClick={() => setShowStatusForm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  <ChevronDown className="w-4 h-4" />
                  Update Status
                </button>
              )}

              {canChangeStatus && showStatusForm && (
                <div className="bg-white p-6 rounded-lg border border-gray-200 space-y-4">
                  <h3 className="font-semibold text-gray-900">Update Application Status</h3>

                  <div className="rounded-md bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-700">
                    Current status: <span className="font-semibold">{STATUS_LABELS[application.status] || application.status}</span>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      New Status
                    </label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select a status...</option>
                      {statusOptions.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </div>

                  {newStatus === "CONDITIONAL_OFFER" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Offer Conditions</label>
                      <textarea
                        value={offerConditions}
                        onChange={(e) => setOfferConditions(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="Enter conditional offer requirements"
                      />
                    </div>
                  )}

                  {newStatus === "UNCONDITIONAL_OFFER" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Offer Letter Upload</label>
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                        onChange={(e) => setOfferLetterFile(e.target.files?.[0] || null)}
                        className="w-full text-sm"
                      />
                    </div>
                  )}

                  {newStatus === "CAS_ISSUED" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">CAS Number</label>
                      <input
                        value={casNumber}
                        onChange={(e) => setCasNumber(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="Enter CAS number"
                      />
                    </div>
                  )}

                  {newStatus === "VISA_APPLIED" && (
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Visa Application Reference</label>
                        <input
                          value={visaApplicationRef}
                          onChange={(e) => setVisaApplicationRef(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Visa Sub-Status</label>
                        <select
                          value={visaSubStatus}
                          onChange={(e) => setVisaSubStatus(e.target.value as "VISA_PENDING" | "VISA_APPROVED" | "VISA_REJECTED")}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        >
                          <option value="VISA_PENDING">Visa Pending</option>
                          <option value="VISA_APPROVED">Visa Approved</option>
                          <option value="VISA_REJECTED">Visa Rejected</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Visa Vignette Reference</label>
                        <input
                          value={visaVignetteRef}
                          onChange={(e) => setVisaVignetteRef(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                      {visaSubStatus === "VISA_REJECTED" && (
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Visa Rejection Reason</label>
                          <textarea
                            value={visaRejectionReason}
                            onChange={(e) => setVisaRejectionReason(e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {newStatus === "WITHDRAWN" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Withdrawal Reason</label>
                      <select
                        value={withdrawalReason}
                        onChange={(e) => setWithdrawalReason(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="">Select reason...</option>
                        <option value="Student request">Student request</option>
                        <option value="University rejection">University rejection</option>
                        <option value="Visa refusal">Visa refusal</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notes
                    </label>
                    <textarea
                      value={statusNotes}
                      onChange={(e) => setStatusNotes(e.target.value)}
                      placeholder="Add notes for this status update..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => updateStatusMutation.mutate()}
                      disabled={!newStatus || updateStatusMutation.isPending}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-2"
                    >
                      {updateStatusMutation.isPending && (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      )}
                      Confirm Update
                    </button>
                    <button
                      onClick={() => {
                        setShowStatusForm(false);
                        setNewStatus("");
                        setStatusNotes("");
                      }}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div className="relative">
                <div className="space-y-6 mt-6">
                  {application.statusHistory.length === 0 ? (
                    <p className="text-gray-600">No status changes yet</p>
                  ) : (
                    application.statusHistory.map((entry, idx) => (
                      <div key={entry.id} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className="w-4 h-4 rounded-full bg-blue-600 border-4 border-white" />
                          {idx < application.statusHistory.length - 1 && (
                            <div className="w-0.5 h-16 bg-gray-300 mt-2" />
                          )}
                        </div>
                        <div className="flex-1 pb-6">
                          <div className="bg-white p-4 rounded-lg border border-gray-200">
                            <div className="flex items-baseline gap-2 mb-2">
                              <span
                                className={`px-2 py-1 text-xs font-medium rounded ${
                                  STATUS_COLORS[entry.status] ||
                                  "bg-gray-100 text-gray-800"
                                }`}
                              >
                                {STATUS_LABELS[entry.status]}
                              </span>
                              <span className="text-xs text-gray-500">
                                {new Date(entry.createdAt).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600">
                              Changed by {entry.changedBy.name || entry.changedBy.email}
                            </p>
                            {entry.notes && (
                              <p className="text-sm text-gray-700 mt-2 italic">
                                &quot;{entry.notes}&quot;
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <ApplicationInterviewTracking applicationId={application.id} roleName={userRole} />

              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <h4 className="text-sm font-semibold text-gray-900">Application Fee</h4>
                <p className="mt-1 text-sm text-gray-700">
                  {application.fee.feeRequired
                    ? `${application.fee.amount.toFixed(2)} ${application.fee.currency} • ${application.fee.feeType?.replaceAll("_", " ") || "Fee"}`
                    : "No fee required for this application."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {canPayOnBehalf && application.fee.feeRequired && application.fee.displayStatus === "UNPAID" && (
                    <button
                      onClick={() => setShowPayOnBehalfModal(true)}
                      className="rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      Pay Application Fee on Behalf of Student
                    </button>
                  )}

                  {application.fee.displayStatus === "PENDING_APPROVAL" && (
                    <button
                      onClick={() => void approveFeePayment("approvePayment")}
                      disabled={processingFeeAction}
                      className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      Approve Payment
                    </button>
                  )}

                  {canApproveWaiver && application.fee.displayStatus === "PENDING_APPROVAL" && (
                    <button
                      onClick={() => void approveFeePayment("approveWaiver")}
                      disabled={processingFeeAction}
                      className="rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      Approve Waiver
                    </button>
                  )}

                  <button
                    onClick={() => void refreshFeeStatus()}
                    className="rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Refresh Fee Status
                  </button>
                </div>
              </div>

              {/* Enrolment Button */}
              {canEnrol && application.status === "VISA_APPLIED" && application.visaSubStatus === "VISA_APPROVED" && (
                <button
                  onClick={handleOpenEnrolmentModal}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Confirm Enrolment & Arrival
                </button>
              )}
            </div>
          )}

          {/* Document Checklist */}
          {activeTab === "documents" && (
            <div className="bg-white p-8 rounded-lg border border-gray-200 text-center">
              <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-left">
                <h4 className="text-sm font-semibold text-slate-900">Milestone Documents</h4>
                <p className="mt-1 text-xs text-slate-600">Five required sections: Application Submission, Offer Letter, Finance, CAS, and Visa.</p>

                {milestonesLoading ? (
                  <p className="mt-3 text-sm text-slate-600">Loading milestone sections...</p>
                ) : (
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {milestoneDocs.map((item) => (
                      <div key={item.id} className="rounded-md border border-slate-200 bg-white p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
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
                        {item.description && <p className="mt-1 text-xs text-slate-500">{item.description}</p>}

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
                            <button
                              type="button"
                              disabled={milestoneActionId === item.id}
                              onClick={() => { void clearMilestoneFile(item); }}
                              className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                            >
                              Clear
                            </button>
                          </div>
                        ) : null}

                        <div className="mt-2 flex flex-wrap gap-2">
                          <label className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer">
                            Upload
                            <input
                              type="file"
                              className="hidden"
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (!file) return;
                                void uploadMilestoneFile(item, file);
                              }}
                            />
                          </label>
                          {canDeleteDocuments && item.fileUrl && (
                            <>
                              <button
                                type="button"
                                disabled={milestoneActionId === item.id}
                                onClick={() => { void updateMilestoneStatus(item, "VERIFIED"); }}
                                className="rounded border border-emerald-300 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                              >
                                Verify
                              </button>
                              <button
                                type="button"
                                disabled={milestoneActionId === item.id}
                                onClick={() => { void updateMilestoneStatus(item, "REJECTED"); }}
                                className="rounded border border-amber-300 px-2 py-1 text-xs text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {!certificateInfo?.signedPdfUrl &&
                certificateInfo?.allVerified &&
                certificateInfo?.checklistId &&
                canGenerateCertificate && (
                  <button
                    onClick={handleGenerateCertificate}
                    disabled={certificateGenerating}
                    className="mb-4 inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {certificateGenerating ? "Generating Certificate..." : "Generate Certificate"}
                  </button>
                )}

              {certificateInfo?.signedPdfUrl && (
                <a
                  href={certificateInfo.signedPdfUrl}
                  className="mb-4 inline-flex items-center rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  Download Verified Certificate
                  {certificateInfo.verificationRef ? ` (${certificateInfo.verificationRef})` : ""}
                </a>
              )}

              {application.status === "UNCONDITIONAL_OFFER" ||
              application.status === "CAS_ISSUED" ||
              application.status === "VISA_APPLIED" ||
              application.status === "ENROLLED" ? (
                <div>
                  <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
                  <p className="text-gray-600">
                    {application.documents.length > 0
                      ? `${application.documents.length} document(s) uploaded`
                      : "No documents uploaded yet"}
                  </p>
                  {application.documents.length > 0 && (
                    <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 text-left">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-slate-600">
                          <tr>
                            <th className="px-3 py-2">Type</th>
                            <th className="px-3 py-2">File</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {application.documents.map((doc) => (
                            <tr key={doc.id} className="border-t border-slate-200">
                              <td className="px-3 py-2">{doc.type.replaceAll("_", " ")}</td>
                              <td className="px-3 py-2">
                                <a
                                  href={toApiFilesPath(doc.fileUrl)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-blue-700 hover:underline"
                                >
                                  {doc.fileName}
                                </a>
                              </td>
                              <td className="px-3 py-2">{doc.status.replaceAll("_", " ")}</td>
                              <td className="px-3 py-2">
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPreviewDoc({ fileName: doc.fileName, fileUrl: toApiFilesPath(doc.fileUrl) });
                                    }}
                                    className="rounded border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                  >
                                    Preview
                                  </button>
                                  <a
                                    href={toApiFilesDownloadPath(doc.fileUrl)}
                                    className="rounded border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                  >
                                    Download
                                  </a>
                                  {canDeleteDocuments && (
                                    <button
                                      type="button"
                                      disabled={deletingDocId === doc.id}
                                      onClick={() => {
                                        void deleteDocument(doc.id);
                                      }}
                                      className="rounded border border-rose-300 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                                    >
                                      {deletingDocId === doc.id ? "Deleting..." : "Delete"}
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">
                    Document checklist appears when unconditional offer is received
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Entry Requirements */}
          {activeTab === "requirements" && (
            <div className="bg-white p-8 rounded-lg border border-gray-200 text-center">
              <p className="text-gray-600">Built in Module 18</p>
            </div>
          )}

          {/* Communications */}
          {activeTab === "communications" && (
            <MessagesThread studentId={application.student.id} />
          )}

          {/* Offer Letter */}
          {activeTab === "offer" && (
            <ApplicationOfferLetterTab
              applicationId={application.id}
              studentId={application.student.id}
              onUploaded={() => setApplication((prev) => ({ ...prev, offerReceivedAt: new Date() }))}
            />
          )}

          {/* Finance */}
          {activeTab === "finance" && (
            <ApplicationFinanceTab
              applicationId={application.id}
              userRole={userRole}
              studentNationality={application.student.nationality || null}
            />
          )}

          {activeTab === "mock-interview" && (
            <MockInterviewTab
              applicationId={application.id}
              listEndpoint={`/api/applications/${application.id}/mock-interviews`}
              canAssign={userRole === "ADMIN" || userRole === "MANAGER" || userRole === "COUNSELLOR"}
              scope="dashboard"
              assignButtonLabel="Assign Mock Interview"
            />
          )}

          {/* Commission */}
          {activeTab === "commission" && (
            <div className="bg-white p-8 rounded-lg border border-gray-200 text-center">
              <p className="text-gray-600">Built in Module 16</p>
            </div>
          )}
        </div>
      </div>

      {showPayOnBehalfModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-lg rounded-lg bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900">Pay Application Fee on Behalf of Student</h2>
            <p className="mt-2 text-sm text-gray-600">
              Fee amount: {application.fee.amount.toFixed(2)} {application.fee.currency}
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Payment Method</label>
                <select
                  value={payOnBehalfMethod}
                  onChange={(event) => setPayOnBehalfMethod(event.target.value as "CASH_RECEIVED" | "BANK_TRANSFER" | "WAIVED")}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                >
                  <option value="CASH_RECEIVED">Cash received from student</option>
                  <option value="BANK_TRANSFER">Bank transfer from student</option>
                  <option value="WAIVED">Waived (requires manager approval)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Payment Reference</label>
                <input
                  value={payOnBehalfRef}
                  onChange={(event) => setPayOnBehalfRef(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  placeholder="Reference / receipt number"
                />
              </div>

              {payOnBehalfMethod !== "WAIVED" && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Upload Receipt</label>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadPayOnBehalfReceipt(file);
                    }}
                    className="w-full text-sm"
                  />
                  {payOnBehalfReceipt && <p className="mt-1 text-xs text-emerald-700">Receipt uploaded</p>}
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowPayOnBehalfModal(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void submitPayOnBehalf()}
                disabled={processingFeeAction}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {processingFeeAction ? "Saving..." : "Confirm Payment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enrolment Confirmation Modal */}
      {showEnrolmentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Confirm Enrolment & Arrival</h2>
            {previewLoading || !enrolmentPreview ? (
              <div className="py-8 text-center text-slate-600">
                <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
                Loading commission breakdown...
              </div>
            ) : (
              <div className="space-y-4 mb-6 text-sm">
                <div className="rounded-md border border-slate-200 p-3 bg-slate-50">
                  <p><span className="font-medium">Student:</span> {enrolmentPreview.studentName}</p>
                  <p><span className="font-medium">University:</span> {enrolmentPreview.university}</p>
                  <p><span className="font-medium">Course:</span> {enrolmentPreview.course}</p>
                  <p><span className="font-medium">Tuition Fee:</span> {enrolmentPreview.tuitionFee.toFixed(2)} {enrolmentPreview.currency}</p>
                  <p><span className="font-medium">University Commission Rate:</span> {enrolmentPreview.universityRate}%</p>
                </div>

                <div className="rounded-md border border-slate-200 p-3">
                  <p className="font-semibold mb-2">Estimated Commission Breakdown</p>
                  <p>Gross Commission: {enrolmentPreview.estimated.grossCommission.toFixed(2)} {enrolmentPreview.currency}</p>
                  <p>Agent Rate: {enrolmentPreview.estimated.agentRate}%</p>
                  <p>Agent Amount: {enrolmentPreview.estimated.agentAmount.toFixed(2)} {enrolmentPreview.currency}</p>
                  <p>EduQuantica Net: {enrolmentPreview.estimated.eduquanticaNet.toFixed(2)} {enrolmentPreview.currency}</p>
                </div>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowEnrolmentModal(false);
                  setEnrolmentPreview(null);
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmEnrolment}
                disabled={updateStatusMutation.isPending || previewLoading || !enrolmentPreview}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
              >
                {updateStatusMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                ) : null}
                Confirm
              </button>
            </div>
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
