"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Clock, Phone as CallIcon, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { MessagesThread } from "@/components/MessagesThread";
import CurrencyDisplay from "@/components/CurrencyDisplay";
import ChecklistStatusIcon from "@/components/ui/ChecklistStatusIcon";
import ChecklistUploadZone from "@/components/ui/ChecklistUploadZone";
import StudyGapIndicator from "@/components/ui/StudyGapIndicator";
import ApplicationInterviewTracking from "@/components/ApplicationInterviewTracking";
import MockInterviewTab from "@/components/MockInterviewTab";
import TestScoresManager from "@/components/student/TestScoresManager";
import QualificationModal from "@/components/student/QualificationModal";
import ApplicationFinanceTab from "@/app/dashboard/applications/[id]/ApplicationFinanceTab";
import DocumentPreviewModal from "@/components/shared/DocumentPreviewModal";
import StudentPaymentsTab from "@/components/shared/StudentPaymentsTab";
import EligibilityStatusBadge from "@/components/shared/EligibilityStatusBadge";
import { LogCallModal } from "@/components/LogCallModal";
import FollowUpModal from "@/components/FollowUpModal";
import { toApiFilesDownloadPath, toApiFilesPath } from "@/lib/file-url";
import {
  APPLICATION_STATUS_LABELS,
  SUB_AGENT_ALLOWED_STATUSES,
  VISA_SUB_STATUS_LABELS,
} from "@/lib/application-pipeline";

type StudentDetailResponse = {
  data: {
    student: {
      id: string;
      fullName: string;
      email: string;
      phone: string | null;
      dateOfBirth: string | null;
      nationality: string | null;
      countryOfResidence: string | null;
      passportNumber: string | null;
      passportExpiry: string | null;
      profileCompletion: number;
      preferredLevel: string | null;
      preferredDestination: string | null;
      preferredFieldOfStudy: string | null;
      highestQualification: string | null;
      yearCompleted: string | null;
      institutionName: string | null;
      notes: string | null;
      studyGapIndicator: {
        colour: "GREEN" | "YELLOW" | "RED";
        gapYears: number;
        lastQualification: string;
      };
      latestMockInterviewResult: "PASS" | "FAIL" | null;
    };
    applications: Array<{
      id: string;
      university: string;
      course: string;
      tuitionFee: number | null;
      currency: string | null;
      intake: string;
      status: string;
      submittedDate: string;
    }>;
    checklist: { label: string; done: boolean }[];
    checklistItems: Array<{
      id: string;
      label: string;
      documentType: string;
      status: "PENDING" | "SCANNING" | "REVISION_REQUIRED" | "VERIFIED" | "REJECTED";
      reason: string | null;
      ocrStatus: string | null;
      documentId: string | null;
      fileName: string | null;
      fileUrl: string | null;
    }>;
    qualifications: Array<{
      id: string;
      qualName: string;
      institutionName: string | null;
      yearCompleted: number | null;
      overallGrade: string | null;
      subjects: Array<{
        id: string;
        subjectName: string;
        rawGrade: string | null;
        gradeType: "GPA" | "LETTER";
        universalScore: number | null;
      }>;
    }>;
    documents: Array<{
      id: string;
      type: string;
      fileName: string;
      fileUrl: string;
      status: string;
      uploadedAt: string;
      scanResult: {
        status: string;
        counsellorDecision: string | null;
        counsellorNote: string | null;
      } | null;
    }>;
    certificate: {
      signedPdfUrl: string | null;
      verificationRef: string | null;
      allVerified: boolean;
    };
  };
};

type AgentCourseRow = {
  id: string;
  name: string;
  level: string;
  fieldOfStudy: string | null;
  tuitionFee: number | null;
  currency: string;
  university: { id: string; name: string; country: string };
  matchStatus: "PENDING" | "FULL_MATCH" | "PARTIAL_MATCH" | "NO_MATCH";
  matchScore: number;
  eligibility: {
    eligible: boolean;
    partiallyEligible: boolean;
    overridden: boolean;
    overriddenBy?: string;
    overriddenAt?: string;
    matchedRequirements: string[];
    missingRequirements: string[];
    message: string;
  };
  scholarshipCount: number;
  scholarshipPreview: {
    id: string;
    name: string;
    amount: number;
    amountType: "FIXED" | "PERCENTAGE";
    deadline: string | null;
  } | null;
};

type AgentWrittenDocument = {
  id: string;
  title: string;
  documentType: "SOP" | "PERSONAL_STATEMENT";
  wordCount: number;
  grammarScore: number | null;
  grammarStatus?: string;
  plagiarismScore: number | null;
  aiContentScore: number | null;
  aiScore?: number | null;
  status: string;
  convertedPdfUrl: string | null;
  updatedAt: string;
  content: string;
};

type TabKey = "overview" | "applications" | "finance" | "documents" | "academic" | "courses" | "wishlist" | "messages" | "mock-interview" | "payments" | "matches";

const GPA_OPTIONS = ["1.0", "1.5", "2.0", "2.5", "3.0", "3.5", "4.0", "4.25", "4.5", "4.75", "5.0"];
const LETTER_OPTIONS = ["A*", "A", "A-", "B+", "B", "B-", "C+", "C", "C-"];

function inferGradeType(value: string | null | undefined): "GPA" | "LETTER" {
  const numeric = Number((value || "").trim());
  if (!Number.isNaN(numeric) && numeric >= 0 && numeric <= 5) return "GPA";
  return "LETTER";
}

function formatTypedGrade(rawGrade: string | null, gradeType: "GPA" | "LETTER") {
  if (!rawGrade) return "-";
  if (gradeType === "GPA") return `${rawGrade} / 5.0 GPA`;
  return rawGrade;
}

function getGrammarScoreBadgeClass(score: number) {
  if (score >= 80) return "bg-emerald-100 text-emerald-700";
  if (score >= 60) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

function getPlagiarismScoreBadgeClass(score: number) {
  if (score <= 20) return "bg-emerald-100 text-emerald-700";
  if (score <= 50) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

function getPlagiarismScoreLabel(score: number) {
  if (score <= 20) return "Original";
  if (score <= 50) return "Some similarity";
  return "High similarity";
}

function getAiScoreBadgeClass(score: number) {
  if (score <= 30) return "bg-emerald-100 text-emerald-700";
  if (score <= 70) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

function getAiScoreLabel(score: number) {
  if (score <= 30) return "Human written";
  if (score <= 70) return "Possibly AI";
  return "Likely AI";
}

interface AcademicSubject {
  id: string;
  subjectName: string;
  rawGrade: string | null;
  gradeType: "GPA" | "LETTER";
  universalScore: number | null;
}

interface AcademicQualification {
  id: string;
  qualType: string;
  qualName: string;
  institutionName: string | null;
  yearCompleted: number | null;
  overallGrade: string | null;
  overallUniversal: number | null;
  subjects: AcademicSubject[];
}

interface MatchCourse {
  id: string;
  name: string;
  level: string;
  fieldOfStudy: string | null;
  university: { id: string; name: string; country: string };
}

interface MatchRow {
  courseId: string;
  matchStatus: "PENDING" | "FULL_MATCH" | "PARTIAL_MATCH" | "NO_MATCH";
  matchScore: number;
  overallMet: boolean;
  overridden?: boolean;
  overriddenByName?: string | null;
  overriddenAt?: string | null;
  englishMet: boolean | null;
  missingSubjects: string[];
  weakSubjects: string[];
  counsellorFlagNote: string | null;
  hasApplication: boolean;
  applicationId: string | null;
  applicationStatus: string | null;
  course: MatchCourse;
}

type EligibilityStatus = {
  eligible: boolean;
  partiallyEligible: boolean;
  overridden: boolean;
  overriddenBy?: string;
  overriddenAt?: string;
  matchedRequirements: string[];
  missingRequirements: string[];
  message: string;
};

interface EligibilityReviewData {
  academicProfileComplete: boolean;
  qualifications: AcademicQualification[];
  matches: MatchRow[];
}

type ErrorResponse = { error?: string };

export default function AgentStudentDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const studentId = params.id;

  const [tab, setTab] = useState<TabKey>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [data, setData] = useState<StudentDetailResponse["data"] | null>(null);
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const [selectedFinanceApplicationId, setSelectedFinanceApplicationId] = useState<string>("");
  const [agentCourses, setAgentCourses] = useState<AgentCourseRow[]>([]);
  const [courseLoading, setCourseLoading] = useState(false);
  const [scholarshipOnly, setScholarshipOnly] = useState(false);
  const [minScholarship, setMinScholarship] = useState(0);
  const [fullScholarshipOnly, setFullScholarshipOnly] = useState(false);
  const [openForNationality, setOpenForNationality] = useState(false);
  const [deadlineNotPassed, setDeadlineNotPassed] = useState(true);
  const [statusModalAppId, setStatusModalAppId] = useState<string | null>(null);
  const [nextStatus, setNextStatus] = useState("");
  const [statusNotes, setStatusNotes] = useState("");
  const [offerConditions, setOfferConditions] = useState("");
  const [casNumber, setCasNumber] = useState("");
  const [visaApplicationRef, setVisaApplicationRef] = useState("");
  const [visaVignetteRef, setVisaVignetteRef] = useState("");
  const [visaSubStatus, setVisaSubStatus] = useState<"VISA_PENDING" | "VISA_APPROVED" | "VISA_REJECTED">("VISA_PENDING");
  const [visaRejectionReason, setVisaRejectionReason] = useState("");
  const [offerLetterFile, setOfferLetterFile] = useState<File | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);
  const [writtenDocs, setWrittenDocs] = useState<AgentWrittenDocument[]>([]);
  const [writtenLoading, setWrittenLoading] = useState(false);
  const [writtenActionLoadingId, setWrittenActionLoadingId] = useState<string | null>(null);
  const [activeWrittenDoc, setActiveWrittenDoc] = useState<AgentWrittenDocument | null>(null);
  const [declarations, setDeclarations] = useState<Array<{ id: string; applicationId: string | null; signatureName: string; signedAt: string; createdAt: string; }>>([]);
  const [declarationsLoading, setDeclarationsLoading] = useState(false);
  const [docSummary, setDocSummary] = useState<{
    pendingUpload: number;
    uploadedScanning: number;
    needsRevision: number;
    verified: number;
    flaggedHigh: number;
    allReady: boolean;
  } | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ fileName: string; fileUrl: string } | null>(null);
  const [editingGradeSubjectId, setEditingGradeSubjectId] = useState<string | null>(null);
  const [gradeDrafts, setGradeDrafts] = useState<Record<string, { grade: string; gradeType: "GPA" | "LETTER" }>>({});
  const [savingGradeSubjectId, setSavingGradeSubjectId] = useState<string | null>(null);
  const [academicActionLoading, setAcademicActionLoading] = useState<string | null>(null);
  const [showQualModal, setShowQualModal] = useState(false);
  const [editingQualification, setEditingQualification] = useState<StudentDetailResponse["data"]["qualifications"][number] | null>(null);
  const [showLogCallModal, setShowLogCallModal] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  // Course Matches
  const [reviewData, setReviewData] = useState<EligibilityReviewData | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [savingNoteCourseId, setSavingNoteCourseId] = useState<string | null>(null);
  const [matchSearch, setMatchSearch] = useState("");
  const [matchCountry, setMatchCountry] = useState("");
  const [matchLevel, setMatchLevel] = useState("");
  // Wishlist
  const [wishlistItems, setWishlistItems] = useState<Array<{ courseId: string; courseName: string; courseLevel: string; universityId: string; universityName: string; universityCountry: string; tuitionFee: number | null; currency: string; addedAt: string; }>>([]);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [wishlistError, setWishlistError] = useState<string | null>(null);
  // Course search text
  const [courseSearch, setCourseSearch] = useState("");
  // Create Application modal
  const [createAppModal, setCreateAppModal] = useState<{ courseId: string; courseName: string; universityId: string; universityName: string } | null>(null);
  const [createAppIntake, setCreateAppIntake] = useState("");
  const [createAppIntakes, setCreateAppIntakes] = useState<string[]>([]);
  const [createAppIsUcas, setCreateAppIsUcas] = useState(false);
  const [createAppStep, setCreateAppStep] = useState<1 | 2 | 3 | 4>(1);
  const [createAppCreated, setCreateAppCreated] = useState<{
    id: string;
    feeRequired: boolean;
    displayStatus: "UNPAID" | "PENDING_APPROVAL" | "PAID" | "WAIVED" | "NOT_REQUIRED";
    amount: number;
    currency: string;
    feeType: "UCAS_SINGLE" | "UCAS_MULTIPLE" | "UNIVERSITY_DIRECT" | null;
    ucasWarning: string | null;
  } | null>(null);
  const [createAppLoading, setCreateAppLoading] = useState(false);
  const [createAppSuccess, setCreateAppSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!createAppModal?.courseId) {
      setCreateAppIntakes([]);
      return;
    }

    (async () => {
      try {
        const res = await fetch(`/api/admin/courses/${createAppModal.courseId}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to fetch course intakes");
        const intakes = json.data?.course?.intakes || [];
        setCreateAppIntakes(intakes);
        if (intakes.length > 0) {
          setCreateAppIntake(intakes[0]);
        }
      } catch {
        setCreateAppIntakes([]);
      }
    })();
  }, [createAppModal?.courseId]);

  useEffect(() => {
    if (!createAppModal) return;
    setCreateAppStep(1);
    setCreateAppCreated(null);
    setCreateAppSuccess(null);
  }, [createAppModal]);

  function closeCreateAppModal() {
    setCreateAppModal(null);
    setCreateAppIntake("");
    setCreateAppIntakes([]);
    setCreateAppIsUcas(false);
    setCreateAppSuccess(null);
    setCreateAppCreated(null);
    setCreateAppStep(1);
  }


  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [studentRes, summaryRes] = await Promise.all([
        fetch(`/api/agent/students/${studentId}`),
        fetch(`/api/admin/students/${studentId}/documents/summary`),
      ]);

      const studentJson = (await studentRes.json()) as StudentDetailResponse | ErrorResponse;
      if (!studentRes.ok) throw new Error(("error" in studentJson && studentJson.error) || "Failed to load student");
      if (!("data" in studentJson)) throw new Error("Invalid response from server");

      if (summaryRes.ok) {
        const summaryJson = await summaryRes.json() as { data?: {
          pendingUpload: number;
          uploadedScanning: number;
          needsRevision: number;
          verified: number;
          flaggedHigh: number;
          allReady: boolean;
        } };
        setDocSummary(summaryJson.data || null);
      } else {
        setDocSummary(null);
      }

      setData(studentJson.data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load student";
      setError(message);
      setDocSummary(null);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    if (!studentId) return;
    fetchData();
  }, [studentId, fetchData]);

  const refreshData = useCallback(() => {
    void fetchData();
  }, [fetchData]);

  const student = data?.student;

  useEffect(() => {
    if (!data?.applications?.length) return;
    const requestedApplicationId = (searchParams.get("applicationId") || "").trim();
    const requestedTab = (searchParams.get("tab") || "").trim().toLowerCase();
    const exists = requestedApplicationId && data.applications.some((app) => app.id === requestedApplicationId);

    setSelectedFinanceApplicationId((prev) => prev || (exists ? requestedApplicationId : data.applications[0].id));
    if (requestedTab === "finance") {
      setTab("finance");
    }
  }, [data?.applications, searchParams]);

  const checklistProgress = useMemo(() => {
    if (!data) return { done: 0, total: 0 };
    const done = data.checklist.filter((c) => c.done).length;
    return { done, total: data.checklist.length };
  }, [data]);

  function checklistStatusText(status: StudentDetailResponse["data"]["checklistItems"][number]["status"]) {
    if (status === "SCANNING") return "Scanning";
    if (status === "REVISION_REQUIRED") return "Revision Required";
    if (status === "VERIFIED") return "Verified";
    if (status === "REJECTED") return "Rejected";
    return "Pending";
  }

  async function uploadForChecklistItem(item: StudentDetailResponse["data"]["checklistItems"][number], file: File) {
    try {
      setUploadingItemId(item.id);
      setError(null);
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
      if (!createRes.ok) throw new Error(createJson.error || "Failed to upload document");

      setInfo(uploadJson.message ? `Document uploaded on behalf of student. ${uploadJson.message}` : "Document uploaded on behalf of student. OCR scan started.");
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload document");
    } finally {
      setUploadingItemId(null);
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
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete document");
    }
  }

  async function updateApplicationStatus() {
    if (!statusModalAppId || !nextStatus) return;

    try {
      setSavingStatus(true);
      let offerLetterFileUrl: string | undefined;
      let offerLetterFileName: string | undefined;

      if (nextStatus === "UNCONDITIONAL_OFFER" && offerLetterFile) {
        const uploadFormData = new FormData();
        uploadFormData.append("files", offerLetterFile);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: uploadFormData });
        const uploadJson = (await uploadRes.json()) as { urls?: string[]; error?: string; message?: string };
        if (!uploadRes.ok || !uploadJson.urls?.[0]) {
          throw new Error(uploadJson.error || "Offer letter upload failed");
        }
        offerLetterFileUrl = uploadJson.urls[0];
        offerLetterFileName = offerLetterFile.name;
        if (uploadJson.message) {
          setInfo(uploadJson.message);
        }
      }

      const res = await fetch(`/api/dashboard/applications/${statusModalAppId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          notes: statusNotes || undefined,
          offerConditions: offerConditions || undefined,
          casNumber: casNumber || undefined,
          visaApplicationRef: visaApplicationRef || undefined,
          visaVignetteRef: visaVignetteRef || undefined,
          visaSubStatus: nextStatus === "VISA_APPLIED" ? visaSubStatus : undefined,
          visaRejectionReason: visaSubStatus === "VISA_REJECTED" ? visaRejectionReason || undefined : undefined,
          offerLetterFileName,
          offerLetterFileUrl,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update application status");

      setInfo(`Application updated to ${APPLICATION_STATUS_LABELS[nextStatus as keyof typeof APPLICATION_STATUS_LABELS] || nextStatus}.`);
      setStatusModalAppId(null);
      setNextStatus("");
      setStatusNotes("");
      setOfferConditions("");
      setCasNumber("");
      setVisaApplicationRef("");
      setVisaVignetteRef("");
      setVisaSubStatus("VISA_PENDING");
      setVisaRejectionReason("");
      setOfferLetterFile(null);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update application status");
    } finally {
      setSavingStatus(false);
    }
  }

  async function saveGrade(qualificationId: string, subjectId: string) {
    const draft = gradeDrafts[subjectId];
    if (!draft) return;

    try {
      setSavingGradeSubjectId(subjectId);
      const res = await fetch(`/api/qualifications/${qualificationId}/subjects/${subjectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grade: draft.grade,
          gradeType: draft.gradeType,
        }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        throw new Error(json.error || "Failed to update grade");
      }

      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          qualifications: prev.qualifications.map((qualification) =>
            qualification.id === qualificationId
              ? {
                  ...qualification,
                  subjects: qualification.subjects.map((subject) =>
                    subject.id === subjectId
                      ? {
                          ...subject,
                          rawGrade: draft.grade,
                          gradeType: draft.gradeType,
                        }
                      : subject,
                  ),
                }
              : qualification,
          ),
        };
      });

      setInfo("Grade updated");
      setEditingGradeSubjectId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update grade");
    } finally {
      setSavingGradeSubjectId(null);
    }
  }

  async function addQualification() {
    setEditingQualification(null);
    setError(null);
    setShowQualModal(true);
  }

  async function editQualification(qualification: StudentDetailResponse["data"]["qualifications"][number]) {
    setEditingQualification(qualification);
    setError(null);
    setShowQualModal(true);
  }

  async function deleteQualification(qualificationId: string) {
    if (!window.confirm("Delete this qualification and all its subjects?")) return;

    setAcademicActionLoading(`delete-qualification-${qualificationId}`);
    setError(null);
    try {
      const res = await fetch(`/api/qualifications/${qualificationId}`, { method: "DELETE" });
      const json = await res.json() as { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to delete qualification");

      setInfo("Qualification deleted");
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete qualification");
    } finally {
      setAcademicActionLoading(null);
    }
  }

  async function addSubject(qualificationId: string) {
    const subjectName = (window.prompt("Subject name") || "").trim();
    if (!subjectName) return;

    const gradeTypeInput = (window.prompt("Grade type (GPA or LETTER)", "LETTER") || "LETTER").trim().toUpperCase();
    if (gradeTypeInput !== "GPA" && gradeTypeInput !== "LETTER") {
      setError("Grade type must be GPA or LETTER.");
      return;
    }

    const grade = (window.prompt("Grade (optional)") || "").trim();

    setAcademicActionLoading(`create-subject-${qualificationId}`);
    setError(null);
    try {
      const res = await fetch(`/api/qualifications/${qualificationId}/subjects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectName,
          grade: grade || undefined,
          gradeType: gradeTypeInput,
        }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to add subject");

      setInfo("Subject added");
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add subject");
    } finally {
      setAcademicActionLoading(null);
    }
  }

  async function deleteSubject(qualificationId: string, subjectId: string) {
    if (!window.confirm("Delete this subject?")) return;

    setAcademicActionLoading(`delete-subject-${subjectId}`);
    setError(null);
    try {
      const res = await fetch(`/api/qualifications/${qualificationId}/subjects/${subjectId}`, {
        method: "DELETE",
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to delete subject");

      setInfo("Subject deleted");
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete subject");
    } finally {
      setAcademicActionLoading(null);
    }
  }

  const fetchCourses = useCallback(async () => {
    try {
      setCourseLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (scholarshipOnly) params.set("scholarshipOnly", "1");
      if (minScholarship > 0) params.set("minScholarship", String(minScholarship));
      if (fullScholarshipOnly) params.set("fullScholarshipOnly", "1");
      if (openForNationality) params.set("openForNationality", "1");
      if (!deadlineNotPassed) params.set("deadlineNotPassed", "0");
      const res = await fetch(`/api/agent/students/${studentId}/courses?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load courses");
      setAgentCourses(json.data?.courses || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load courses");
    } finally {
      setCourseLoading(false);
    }
  }, [deadlineNotPassed, fullScholarshipOnly, minScholarship, openForNationality, scholarshipOnly, studentId]);

  useEffect(() => {
    if (tab !== "courses") return;
    void fetchCourses();
  }, [tab, fetchCourses]);

  const fetchWishlist = useCallback(async () => {
    setWishlistLoading(true);
    setWishlistError(null);
    try {
      const res = await fetch(`/api/students/${studentId}/wishlist`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load wishlist");
      setWishlistItems(json.data || []);
    } catch (err) {
      setWishlistError(err instanceof Error ? err.message : "Failed to load wishlist");
    } finally {
      setWishlistLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    if (tab !== "wishlist") return;
    void fetchWishlist();
  }, [tab, fetchWishlist]);

  async function addToWishlist(courseId: string) {
    try {
      const res = await fetch(`/api/students/${studentId}/wishlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to add to wishlist");
      }
      toast.success("Added to wishlist");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add to wishlist");
    }
  }

  async function removeFromWishlist(courseId: string) {
    try {
      const res = await fetch(`/api/students/${studentId}/wishlist/${courseId}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to remove from wishlist");
      }
      toast.success("Removed from wishlist");
      setWishlistItems((prev) => prev.filter((item) => item.courseId !== courseId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove from wishlist");
    }
  }

  function toEligibilityStatus(match: MatchRow): EligibilityStatus {
    if (match.matchStatus === "PENDING") {
      return {
        eligible: false,
        partiallyEligible: false,
        overridden: false,
        matchedRequirements: [],
        missingRequirements: [],
        message: "Add qualifications to check eligibility",
      };
    }

    const missingRequirements = [
      ...match.missingSubjects.map((subject) => `Missing subject: ${subject}`),
      ...match.weakSubjects.map((subject) => `Weak subject score: ${subject}`),
    ];

    return {
      eligible: match.matchStatus === "FULL_MATCH" || Boolean(match.overridden),
      partiallyEligible: match.matchStatus === "PARTIAL_MATCH",
      overridden: Boolean(match.overridden),
      overriddenBy: match.overriddenByName || undefined,
      overriddenAt: match.overriddenAt || undefined,
      matchedRequirements: [],
      missingRequirements,
      message: match.matchStatus === "FULL_MATCH" ? "All checked requirements met" : "Eligibility requirements not fully met",
    };
  }

  const fetchEligibilityReview = useCallback(async () => {
    setReviewLoading(true);
    setReviewError(null);
    try {
      const res = await fetch(`/api/admin/students/${studentId}/eligibility-review`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to load eligibility review");
      }

      const payload = json.data as EligibilityReviewData;
      setReviewData(payload);

      const draftNotes: Record<string, string> = {};
      for (const match of payload.matches || []) {
        draftNotes[match.courseId] = match.counsellorFlagNote || "";
      }
      setNoteDrafts(draftNotes);
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "Failed to load eligibility review");
    } finally {
      setReviewLoading(false);
    }
  }, [studentId]);

  async function saveCounsellorNote(courseId: string) {
    setSavingNoteCourseId(courseId);
    try {
      const res = await fetch(
        `/api/admin/students/${studentId}/course-matches/${courseId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            counsellorFlagNote: noteDrafts[courseId] || null,
          }),
        }
      );
      if (!res.ok) throw new Error("Failed to save note");
      toast.success("Note saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save note");
    } finally {
      setSavingNoteCourseId(null);
    }
  }

  async function markCourseAsEligible(courseId: string) {
    if (!window.confirm("This student is currently Not Eligible or Partially Eligible for this course. Mark as Eligible manually?")) return;

    try {
      const res = await fetch(`/api/admin/students/${studentId}/course-matches/${courseId}`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to override eligibility");
      await fetchEligibilityReview();
      toast.success("Course marked as eligible");
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "Failed to override eligibility");
    }
  }

  async function createApplicationForStudent() {
    if (!createAppModal || !createAppIntake.trim()) return;
    setCreateAppLoading(true);
    setCreateAppSuccess(null);
    setCreateAppCreated(null);
    try {
      const res = await fetch("/api/dashboard/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: studentId,
          courseId: createAppModal.courseId,
          universityId: createAppModal.universityId,
          intake: createAppIntake.trim(),
          isUcas: createAppIsUcas,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create application");
      const appId: string = json.data?.id || "";
      const fee = json.data?.fee;
      setCreateAppCreated({
        id: appId,
        feeRequired: Boolean(fee?.feeRequired),
        displayStatus: (fee?.displayStatus || "NOT_REQUIRED") as "UNPAID" | "PENDING_APPROVAL" | "PAID" | "WAIVED" | "NOT_REQUIRED",
        amount: Number(fee?.amount || 0),
        currency: String(fee?.currency || "GBP"),
        feeType: (fee?.feeType || null) as "UCAS_SINGLE" | "UCAS_MULTIPLE" | "UNIVERSITY_DIRECT" | null,
        ucasWarning: (json.data?.ucasWarning || null) as string | null,
      });
      setCreateAppSuccess(appId ? `Application created! ID: ${appId}` : "Application created!");
      setCreateAppStep(4);
      toast.success("Application created successfully");
      // Refresh student data (includes applications list) and switch to Applications tab
      await fetchData();
      setTab("applications");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create application");
    } finally {
      setCreateAppLoading(false);
    }
  }

  useEffect(() => {
    if (tab !== "documents") return;
    setDeclarationsLoading(true);
    fetch(`/api/student/declarations?studentId=${studentId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json: { data?: Array<{ id: string; applicationId: string | null; signatureName: string; signedAt: string; createdAt: string }> }) => { setDeclarations(json.data || []); })
      .catch(() => { setDeclarations([]); })
      .finally(() => { setDeclarationsLoading(false); });
  }, [tab, studentId]);

  useEffect(() => {
    if (tab !== "documents") return;

    let mounted = true;
    async function loadWrittenDocs() {
      setWrittenLoading(true);
      try {
        const res = await fetch(`/api/counsellor/students/${studentId}/documents/written`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load written documents");
        if (mounted) setWrittenDocs(json.data || []);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "Failed to load written documents");
      } finally {
        if (mounted) setWrittenLoading(false);
      }
    }

    void loadWrittenDocs();
    return () => {
      mounted = false;
    };
  }, [studentId, tab]);

  useEffect(() => {
    if (tab !== "academic" && tab !== "matches") return;
    void fetchEligibilityReview();
  }, [tab, studentId, fetchEligibilityReview]);

  async function handleWrittenDecision(documentId: string, action: "APPROVE" | "REJECT") {
    const reason = action === "REJECT" ? window.prompt("Enter rejection reason") || "" : "";
    if (action === "REJECT" && !reason.trim()) {
      setError("Rejection reason is required.");
      return;
    }

    setWrittenActionLoadingId(documentId);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(`/api/counsellor/students/${studentId}/documents/written/${documentId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: reason.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to update document status");
      }

      setInfo(action === "APPROVE" ? "Written document approved." : "Written document rejected.");
      if (tab === "documents") {
        const reload = await fetch(`/api/counsellor/students/${studentId}/documents/written`, { cache: "no-store" });
        const reloadJson = await reload.json();
        if (reload.ok) setWrittenDocs(reloadJson.data || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update written document");
    } finally {
      setWrittenActionLoadingId(null);
    }
  }

  if (loading) return <div className="portal-shell-card p-4 text-sm text-slate-500">Loading student...</div>;
  if (error || !student) return <div className="portal-shell-card border-red-200 p-4 text-sm text-red-600">{error || "Student not found"}</div>;

  return (
    <div className="space-y-5">
      <div className="portal-shell-card p-5">
        <h1 className="text-2xl font-bold text-slate-900 inline-flex items-center gap-2">
          <span>{student.fullName}</span>
          <StudyGapIndicator colour={student.studyGapIndicator.colour} size="md" />
          {student.latestMockInterviewResult && (
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                student.latestMockInterviewResult === "PASS"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-rose-100 text-rose-700"
              }`}
            >
              Mock Interview {student.latestMockInterviewResult}
            </span>
          )}
        </h1>
        <p className="text-sm text-slate-500 mt-1">{student.email}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link
            href="/agent/cv-builder"
            className="portal-btn-accent inline-flex items-center px-3 py-1.5 text-xs"
          >
            Download CV
          </Link>
          <button
            type="button"
            onClick={() => setShowLogCallModal(true)}
            className="portal-btn-ghost inline-flex items-center gap-2 px-3 py-1.5 text-xs"
          >
            <CallIcon className="h-3.5 w-3.5" />
            Log Call
          </button>
          <button
            type="button"
            onClick={() => setShowFollowUpModal(true)}
            className="portal-btn-ghost inline-flex items-center gap-2 px-3 py-1.5 text-xs"
          >
            <Clock className="h-3.5 w-3.5" />
            Schedule Follow-Up
          </button>
        </div>

        {docSummary && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            <div className="portal-shell-card p-3">
              <div className="text-xs text-slate-500">Pending upload</div>
              <div className="font-semibold text-slate-800">{docSummary.pendingUpload}</div>
            </div>
            <div className="portal-shell-card p-3">
              <div className="text-xs text-slate-500">Uploaded scanning</div>
              <div className="font-semibold text-slate-800">{docSummary.uploadedScanning}</div>
            </div>
            <div className="portal-shell-card p-3">
              <div className="text-xs text-slate-500">Needs revision</div>
              <div className="font-semibold text-amber-600">{docSummary.needsRevision}</div>
            </div>
            <div className="portal-shell-card p-3">
              <div className="text-xs text-slate-500">Verified</div>
              <div className="font-semibold text-emerald-600">{docSummary.verified}</div>
            </div>
            <div className="portal-shell-card p-3">
              <div className="text-xs text-slate-500">Flagged HIGH risk</div>
              <div className="font-semibold text-red-600">{docSummary.flaggedHigh}</div>
            </div>
          </div>
        )}
      </div>

      <div className="portal-shell-card">
        <div className="flex overflow-x-auto border-b border-[var(--eq-border)] px-2">
          {(["overview", "applications", "finance", "documents", "academic", "courses", "wishlist", "messages", "mock-interview", "payments", "matches"] as TabKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-3 text-sm font-medium capitalize whitespace-nowrap ${
                tab === key ? "border-b-2 border-amber-500 text-amber-600" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {key}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === "overview" && (
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <Info label="Phone" value={student.phone} />
              <Info label="Date of Birth" value={student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString() : null} />
              <Info label="Nationality" value={student.nationality} />
              <Info label="Country of Residence" value={student.countryOfResidence} />
              <Info label="Passport Number" value={student.passportNumber} />
              <Info label="Passport Expiry" value={student.passportExpiry ? new Date(student.passportExpiry).toLocaleDateString() : null} />
              <Info label="Highest Qualification" value={student.highestQualification} />
              <Info label="Year Completed" value={student.yearCompleted} />
              <Info label="Institution" value={student.institutionName} />
              <Info label="Preferred Level" value={student.preferredLevel} />
              <Info label="Preferred Destination" value={student.preferredDestination} />
              <Info label="Preferred Field" value={student.preferredFieldOfStudy} />
              <Info label="Profile Completion" value={`${student.profileCompletion}%`} />
              <Info label="Checklist" value={`${checklistProgress.done}/${checklistProgress.total}`} />
              <div className="md:col-span-2">
                <p className="text-xs text-slate-500">Notes</p>
                <p className="text-slate-800 mt-1">{student.notes || "-"}</p>
              </div>
            </div>
          )}

          {tab === "applications" && (
            <div>
              <div className="mb-4">
                <button
                  type="button"
                  onClick={() => setCreateAppModal({ courseId: "", courseName: "Search courses", universityId: "", universityName: "" })}
                  className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  + Add Application
                </button>
              </div>
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-slate-500">
                    <tr>
                      <th className="py-2 pr-4">University</th>
                      <th className="py-2 pr-4">Course</th>
                      <th className="py-2 pr-4">Tuition</th>
                      <th className="py-2 pr-4">Intake</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Submitted</th>
                      <th className="py-2 pr-4">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.applications.length === 0 ? (
                      <tr><td className="py-3 text-slate-500" colSpan={7}>No applications yet</td></tr>
                    ) : data.applications.map((app) => (
                      <tr key={app.id} className="border-t border-slate-100">
                        <td className="py-2 pr-4">{app.university}</td>
                        <td className="py-2 pr-4">{app.course}</td>
                        <td className="py-2 pr-4">
                          {typeof app.tuitionFee === "number" ? (
                            <CurrencyDisplay
                              amount={app.tuitionFee}
                              baseCurrency={app.currency || "GBP"}
                              studentNationality={student.nationality || undefined}
                            />
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="py-2 pr-4">{app.intake}</td>
                        <td className="py-2 pr-4">
                          <span className="px-2 py-1 rounded-full text-xs bg-slate-100 text-slate-700">{app.status.replace(/_/g, " ")}</span>
                        </td>
                        <td className="py-2 pr-4">{new Date(app.submittedDate).toLocaleDateString()}</td>
                        <td className="py-2 pr-4 space-x-2">
                          <button
                            onClick={() => {
                              setSelectedFinanceApplicationId(app.id);
                            }}
                            className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Track Interviews
                          </button>
                          <button
                            onClick={() => {
                              setStatusModalAppId(app.id);
                              setNextStatus("");
                              setStatusNotes("");
                              setOfferConditions("");
                              setCasNumber("");
                              setVisaApplicationRef("");
                              setVisaVignetteRef("");
                              setVisaSubStatus("VISA_PENDING");
                              setVisaRejectionReason("");
                              setOfferLetterFile(null);
                            }}
                            className="rounded border border-blue-300 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
                          >
                            Update Status
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedFinanceApplicationId && (
                <ApplicationInterviewTracking applicationId={selectedFinanceApplicationId} roleName="SUB_AGENT" />
              )}
            </div>
            </div>
          )}

          {tab === "finance" && (
            <div className="space-y-3">
              {data.applications.length === 0 ? (
                <p className="text-sm text-slate-500">No applications available for finance workflow.</p>
              ) : (
                <>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <label className="mb-1 block text-xs font-medium text-slate-600">Select Application</label>
                    <select
                      value={selectedFinanceApplicationId}
                      onChange={(e) => setSelectedFinanceApplicationId(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      {data.applications.map((app) => (
                        <option key={app.id} value={app.id}>
                          {app.university} — {app.course}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedFinanceApplicationId && (
                    <ApplicationFinanceTab
                      applicationId={selectedFinanceApplicationId}
                      userRole="SUB_AGENT"
                      studentNationality={student.nationality}
                    />
                  )}
                </>
              )}
            </div>
          )}

          {tab === "documents" && (
            <div className="space-y-4">
              {info && <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">{info}</div>}
              {data.certificate?.signedPdfUrl && (
                <a
                  href={data.certificate.signedPdfUrl}
                  className="inline-flex rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Download Verified Certificate
                  {data.certificate.verificationRef ? ` (${data.certificate.verificationRef})` : ""}
                </a>
              )}
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                Checklist Progress: <span className="font-semibold">{checklistProgress.done}/{checklistProgress.total}</span>
              </div>

              <div className="space-y-3">
                {data.checklistItems.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <ChecklistStatusIcon status={item.status} />
                          <p className="truncate text-sm font-semibold text-slate-900">{item.label}</p>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{checklistStatusText(item.status)}</p>
                        {item.reason && (
                          <p className={`mt-2 text-xs ${item.status === "REJECTED" ? "text-red-700" : "text-amber-700"}`}>
                            {item.reason}
                          </p>
                        )}
                        {item.fileUrl && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setPreviewDoc({ fileName: item.fileName || "Document", fileUrl: toApiFilesPath(item.fileUrl) });
                              }}
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
                        )}
                      </div>
                    </div>

                    <div className="mt-3">
                      <ChecklistUploadZone
                        compact
                        uploading={uploadingItemId === item.id}
                        checklistItemId={item.id}
                        studentId={student.id}
                        checklistItemName={item.label}
                        onMobileUploadCompleted={() => {
                          void fetchData();
                        }}
                        onFileSelected={async (file) => {
                          await uploadForChecklistItem(item, file);
                        }}
                      />
                    </div>
                  </div>
                ))}
                {data.checklistItems.length === 0 && (
                  <p className="text-sm text-slate-500">No checklist items found yet.</p>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-900">Written Documents</h3>
                {writtenLoading ? (
                  <p className="mt-2 text-sm text-slate-500">Loading written documents...</p>
                ) : writtenDocs.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">No written documents submitted yet.</p>
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-slate-500">
                          <th className="py-2 pr-3">Title</th>
                          <th className="py-2 pr-3">Type</th>
                          <th className="py-2 pr-3">Words</th>
                          <th className="py-2 pr-3">Grammar</th>
                          <th className="py-2 pr-3">Plagiarism</th>
                          <th className="py-2 pr-3">AI</th>
                          <th className="py-2 pr-3">Status</th>
                          <th className="py-2 pr-3">Date</th>
                          <th className="py-2 pr-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {writtenDocs.map((doc) => (
                          <tr key={doc.id} className="border-b last:border-0">
                            <td className="py-2 pr-3">{doc.title}</td>
                            <td className="py-2 pr-3">{doc.documentType === "SOP" ? "SOP" : "Personal Statement"}</td>
                            <td className="py-2 pr-3">{doc.wordCount}</td>
                            <td className="py-2 pr-3">
                              {doc.grammarScore != null ? (
                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getGrammarScoreBadgeClass(doc.grammarScore)}`}>
                                  {doc.grammarScore}%
                                </span>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td className="py-2 pr-3">
                              {doc.plagiarismScore != null ? (
                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getPlagiarismScoreBadgeClass(doc.plagiarismScore)}`}>
                                  {getPlagiarismScoreLabel(doc.plagiarismScore)}
                                </span>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td className="py-2 pr-3">
                              {(doc.aiContentScore ?? doc.aiScore) != null ? (
                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getAiScoreBadgeClass(doc.aiContentScore ?? doc.aiScore ?? 0)}`}>
                                  {getAiScoreLabel(doc.aiContentScore ?? doc.aiScore ?? 0)}
                                </span>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td className="py-2 pr-3">{doc.status}</td>
                            <td className="py-2 pr-3">{new Date(doc.updatedAt).toLocaleDateString("en-GB")}</td>
                            <td className="py-2 pr-3">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => setActiveWrittenDoc(doc)}
                                  className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                                >
                                  View
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleWrittenDecision(doc.id, "APPROVE")}
                                  disabled={writtenActionLoadingId === doc.id}
                                  className="rounded border border-emerald-300 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleWrittenDecision(doc.id, "REJECT")}
                                  disabled={writtenActionLoadingId === doc.id}
                                  className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-60"
                                >
                                  Reject
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {activeWrittenDoc && (
                <div
                  className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
                  onClick={() => setActiveWrittenDoc(null)}
                >
                  <div
                    className="w-full max-w-4xl rounded-xl bg-white shadow-xl"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">{activeWrittenDoc.title}</h3>
                        <span className="mt-1 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                          {activeWrittenDoc.documentType === "SOP" ? "SOP" : "Personal Statement"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveWrittenDoc(null)}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        Close
                      </button>
                    </div>

                    <div className="space-y-4 px-5 py-4">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <p className="text-xs text-slate-500">Grammar</p>
                          {activeWrittenDoc.grammarScore != null ? (
                            <span className={`mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${getGrammarScoreBadgeClass(activeWrittenDoc.grammarScore)}`}>
                              {activeWrittenDoc.grammarScore}%
                            </span>
                          ) : (
                            <p className="mt-1 text-sm text-slate-700">-</p>
                          )}
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <p className="text-xs text-slate-500">Plagiarism</p>
                          {activeWrittenDoc.plagiarismScore != null ? (
                            <span className={`mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${getPlagiarismScoreBadgeClass(activeWrittenDoc.plagiarismScore)}`}>
                              {getPlagiarismScoreLabel(activeWrittenDoc.plagiarismScore)}
                            </span>
                          ) : (
                            <p className="mt-1 text-sm text-slate-700">-</p>
                          )}
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <p className="text-xs text-slate-500">AI</p>
                          {(activeWrittenDoc.aiContentScore ?? activeWrittenDoc.aiScore) != null ? (
                            <span className={`mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${getAiScoreBadgeClass(activeWrittenDoc.aiContentScore ?? activeWrittenDoc.aiScore ?? 0)}`}>
                              {getAiScoreLabel(activeWrittenDoc.aiContentScore ?? activeWrittenDoc.aiScore ?? 0)}
                            </span>
                          ) : (
                            <p className="mt-1 text-sm text-slate-700">-</p>
                          )}
                        </div>
                      </div>

                      <div className="max-h-[50vh] overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-7 whitespace-pre-wrap text-slate-700">
                        {activeWrittenDoc.content || "No content available."}
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4">
                      <button
                        type="button"
                        onClick={() => setActiveWrittenDoc(null)}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        Close
                      </button>
                      {activeWrittenDoc.convertedPdfUrl ? (
                        <a
                          href={activeWrittenDoc.convertedPdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                        >
                          Download as PDF
                        </a>
                      ) : (
                        <span className="text-xs text-slate-500">PDF is not available yet.</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Signed Declarations Section */}
              {(() => {
                const passportDocs = (data.documents || []).filter((d) => d.type === "PASSPORT");
                if (passportDocs.length === 0) return null;
                return (
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <h3 className="text-sm font-semibold text-slate-900">Passport</h3>
                    <div className="mt-3 overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-slate-500">
                            <th className="py-2 pr-3">Document</th>
                            <th className="py-2 pr-3">Verification Status</th>
                            <th className="py-2 pr-3">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {passportDocs.map((doc) => {
                            let verificationLabel = "Pending";
                            let verificationClass = "bg-amber-100 text-amber-700";

                            if (doc.scanResult?.counsellorDecision === "REVISION_REQUIRED") {
                              verificationLabel = "Needs Revision";
                              verificationClass = "bg-amber-100 text-amber-700";
                            } else if (doc.status === "VERIFIED") {
                              verificationLabel = "Verified";
                              verificationClass = "bg-emerald-100 text-emerald-700";
                            } else if (doc.status === "REJECTED") {
                              verificationLabel = "Rejected";
                              verificationClass = "bg-red-100 text-red-700";
                            }
                            return (
                              <tr key={doc.id} className="border-b last:border-0">
                                <td className="py-2 pr-3 align-top">
                                  <p className="font-medium text-slate-900">Passport</p>
                                  <p className="text-xs text-slate-500">{doc.fileName}</p>
                                </td>
                                <td className="py-2 pr-3 align-top">
                                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${verificationClass}`}>
                                    {verificationLabel}
                                  </span>
                                </td>
                                <td className="py-2 pr-3 align-top">
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setPreviewDoc({ fileName: doc.fileName, fileUrl: toApiFilesPath(doc.fileUrl) })}
                                      className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                                    >
                                      Preview
                                    </button>
                                    <a
                                      href={toApiFilesDownloadPath(doc.fileUrl)}
                                      className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                                    >
                                      Download
                                    </a>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-900">Signed Declarations</h3>
                {declarationsLoading ? (
                  <p className="text-sm text-slate-500">Loading declarations...</p>
                ) : declarations.length === 0 ? (
                  <p className="text-sm text-slate-500">No signed declarations found.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-slate-600">
                          <th className="px-2 py-2 font-medium">Signed At</th>
                          <th className="px-2 py-2 font-medium">Signature Name</th>
                          <th className="px-2 py-2 font-medium">Application</th>
                          <th className="px-2 py-2 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {declarations.map((dec) => (
                          <tr key={dec.id} className="border-b border-slate-100">
                            <td className="px-2 py-2 text-slate-700">{new Date(dec.signedAt).toLocaleDateString("en-GB")}</td>
                            <td className="px-2 py-2 text-slate-700">{dec.signatureName}</td>
                            <td className="px-2 py-2 text-slate-700">{dec.applicationId || "-"}</td>
                            <td className="px-2 py-2">
                              <a
                                href={`/api/student/declarations/${dec.id}/pdf`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded border border-blue-300 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
                              >
                                Download PDF
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "academic" && (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Academic Profile</h3>
                  <p className="text-sm text-slate-500">Review and update subject grades.</p>
                </div>
                <button
                  type="button"
                  disabled={academicActionLoading === "create-qualification"}
                  onClick={() => {
                    void addQualification();
                  }}
                  className="rounded border border-blue-300 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-60"
                >
                  {academicActionLoading === "create-qualification" ? "Adding..." : "Add Qualification"}
                </button>
              </div>
              {data.qualifications.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-500">No qualifications available yet.</p>
                  <button
                    type="button"
                    disabled={academicActionLoading === "create-qualification"}
                    onClick={() => {
                      void addQualification();
                    }}
                    className="rounded border border-blue-300 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-60"
                  >
                    {academicActionLoading === "create-qualification" ? "Adding..." : "Add First Qualification"}
                  </button>
                </div>
              ) : (
                data.qualifications.map((qualification) => (
                  <div key={qualification.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-900">{qualification.qualName}</p>
                        <p className="text-xs text-slate-500">
                          {qualification.institutionName || "-"} • {qualification.yearCompleted || "-"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-slate-600">Overall: {qualification.overallGrade || "-"}</p>
                        <button
                          type="button"
                          disabled={academicActionLoading === `edit-qualification-${qualification.id}`}
                          onClick={() => {
                            void editQualification(qualification);
                          }}
                          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        >
                          Edit Qualification
                        </button>
                        <button
                          type="button"
                          disabled={academicActionLoading === `delete-qualification-${qualification.id}`}
                          onClick={() => {
                            void deleteQualification(qualification.id);
                          }}
                          className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-60"
                        >
                          Delete Qualification
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-slate-500">
                            <th className="py-2 pr-3">Subject</th>
                            <th className="py-2 pr-3">Grade Type</th>
                            <th className="py-2 pr-3">Grade</th>
                            <th className="py-2 pr-3">Universal</th>
                            <th className="py-2 pr-3">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {qualification.subjects.length === 0 && (
                            <tr>
                              <td className="py-2 pr-3 text-slate-500" colSpan={5}>No subjects yet.</td>
                            </tr>
                          )}
                          {qualification.subjects.map((subject) => {
                            const isEditingGrade = editingGradeSubjectId === subject.id;
                            const draft = gradeDrafts[subject.id] || {
                              grade: subject.rawGrade || "",
                              gradeType: subject.gradeType || inferGradeType(subject.rawGrade),
                            };

                            return (
                              <tr key={subject.id} className="border-b last:border-0">
                                <td className="py-2 pr-3">{subject.subjectName}</td>
                                <td className="py-2 pr-3">
                                  {isEditingGrade ? (
                                    <select
                                      value={draft.gradeType}
                                      onChange={(event) =>
                                        setGradeDrafts((prev) => ({
                                          ...prev,
                                          [subject.id]: {
                                            grade: "",
                                            gradeType: event.target.value as "GPA" | "LETTER",
                                          },
                                        }))
                                      }
                                      className="w-full rounded border border-slate-300 px-2 py-1"
                                    >
                                      <option value="GPA">GPA Score</option>
                                      <option value="LETTER">Letter Grade</option>
                                    </select>
                                  ) : (
                                    subject.gradeType || inferGradeType(subject.rawGrade)
                                  )}
                                </td>
                                <td className="py-2 pr-3">
                                  {isEditingGrade ? (
                                    draft.gradeType === "GPA" ? (
                                      <>
                                        <input
                                          type="number"
                                          min={0}
                                          max={5}
                                          step="0.01"
                                          list={`gpa-agent-${subject.id}`}
                                          value={draft.grade}
                                          onChange={(event) =>
                                            setGradeDrafts((prev) => ({
                                              ...prev,
                                              [subject.id]: {
                                                ...draft,
                                                grade: event.target.value,
                                              },
                                            }))
                                          }
                                          className="w-full rounded border border-slate-300 px-2 py-1"
                                        />
                                        <datalist id={`gpa-agent-${subject.id}`}>
                                          {GPA_OPTIONS.map((grade) => (
                                            <option key={grade} value={grade} />
                                          ))}
                                        </datalist>
                                      </>
                                    ) : (
                                      <select
                                        value={draft.grade}
                                        onChange={(event) =>
                                          setGradeDrafts((prev) => ({
                                            ...prev,
                                            [subject.id]: {
                                              ...draft,
                                              grade: event.target.value,
                                            },
                                          }))
                                        }
                                        className="w-full rounded border border-slate-300 px-2 py-1"
                                      >
                                        <option value="">Select</option>
                                        {LETTER_OPTIONS.map((grade) => (
                                          <option key={grade} value={grade}>{grade}</option>
                                        ))}
                                      </select>
                                    )
                                  ) : (
                                    formatTypedGrade(subject.rawGrade, subject.gradeType || inferGradeType(subject.rawGrade))
                                  )}
                                </td>
                                <td className="py-2 pr-3">{subject.universalScore != null ? subject.universalScore.toFixed(1) : "-"}</td>
                                <td className="py-2 pr-3">
                                  {isEditingGrade ? (
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          void saveGrade(qualification.id, subject.id);
                                        }}
                                        disabled={savingGradeSubjectId === subject.id}
                                        className="rounded bg-blue-600 px-3 py-1 text-xs text-white disabled:opacity-60"
                                      >
                                        {savingGradeSubjectId === subject.id ? "Saving..." : "Save"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingGradeSubjectId(null)}
                                        className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-700"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingGradeSubjectId(subject.id);
                                          setGradeDrafts((prev) => ({
                                            ...prev,
                                            [subject.id]: {
                                              grade: subject.rawGrade || "",
                                              gradeType: subject.gradeType || inferGradeType(subject.rawGrade),
                                            },
                                          }));
                                        }}
                                        className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
                                      >
                                        Edit Grade
                                      </button>
                                      <button
                                        type="button"
                                        disabled={academicActionLoading === `delete-subject-${subject.id}`}
                                        onClick={() => {
                                          void deleteSubject(qualification.id, subject.id);
                                        }}
                                        className="rounded border border-red-300 px-3 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-60"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-3">
                      <button
                        type="button"
                        disabled={academicActionLoading === `create-subject-${qualification.id}`}
                        onClick={() => {
                          void addSubject(qualification.id);
                        }}
                        className="rounded border border-blue-300 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-60"
                      >
                        {academicActionLoading === `create-subject-${qualification.id}` ? "Adding..." : "Add Subject"}
                      </button>
                    </div>
                  </div>
                ))
              )}

              <div className="border-t border-slate-200 pt-4">
                <TestScoresManager studentId={student.id} canManage={true} title="Test Scores" />
              </div>
            </div>
          )}

          {tab === "messages" && (
            <div className="h-[560px]">
              <MessagesThread studentId={student.id} />
            </div>
          )}

          {tab === "courses" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="text"
                    placeholder="Search by course or university…"
                    value={courseSearch}
                    onChange={(e) => setCourseSearch(e.target.value)}
                    className="flex-1 min-w-[180px] rounded border border-slate-300 px-3 py-1.5 text-sm"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={scholarshipOnly} onChange={(e) => setScholarshipOnly(e.target.checked)} />
                      Scholarship only
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={fullScholarshipOnly} onChange={(e) => setFullScholarshipOnly(e.target.checked)} />
                      Full scholarship only
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={openForNationality} onChange={(e) => setOpenForNationality(e.target.checked)} />
                      Open for nationality
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={deadlineNotPassed} onChange={(e) => setDeadlineNotPassed(e.target.checked)} />
                      Deadline not passed
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm">
                      Min value
                      <input type="number" min={0} value={minScholarship} onChange={(e) => setMinScholarship(Number(e.target.value))} className="w-24 rounded border border-slate-300 px-2 py-1" />
                    </label>
                    <button onClick={() => void fetchCourses()} className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700">Apply</button>
                  </div>
                </div>
              </div>

              {courseLoading ? (
                <p className="text-sm text-slate-500">Loading course view...</p>
              ) : agentCourses.length === 0 ? (
                <p className="text-sm text-slate-500">No courses found for current filters.</p>
              ) : (
                <div className="space-y-3">
                  {agentCourses
                    .filter((course) => {
                      const q = courseSearch.toLowerCase();
                      return !q ||
                        course.name.toLowerCase().includes(q) ||
                        course.university.name.toLowerCase().includes(q);
                    })
                    .map((course) => (
                    <div key={course.id} className="rounded-lg border border-slate-200 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{course.name}</p>
                          <p className="text-xs text-slate-600">{course.university.name} • {course.university.country}</p>
                          <p className="text-xs text-slate-500">{course.level}{course.fieldOfStudy ? ` • ${course.fieldOfStudy}` : ""}</p>
                          {course.scholarshipCount > 0 && (
                            <span
                              className="mt-2 inline-block rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-700"
                              title={course.scholarshipPreview
                                ? `${course.scholarshipPreview.name} • ${course.scholarshipPreview.amountType === "PERCENTAGE" ? `${course.scholarshipPreview.amount}%` : course.scholarshipPreview.amount.toLocaleString()}`
                                : "Scholarship available"
                              }
                            >
                              Scholarship Available
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-500">Match</p>
                          <EligibilityStatusBadge status={course.eligibility} isStaff={false} className="text-right" />
                          <p className="text-xs text-slate-500 mt-1">Score: {course.matchScore.toFixed(1)}</p>
                          <p className="text-sm text-slate-700 mt-1">
                            {course.tuitionFee != null ? (
                              <CurrencyDisplay
                                amount={course.tuitionFee}
                                baseCurrency={course.currency}
                                studentNationality={student.nationality || undefined}
                              />
                            ) : "-"}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void addToWishlist(course.id)}
                          className="rounded border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50"
                        >
                          Save to Wishlist
                        </button>
                        <button
                          type="button"
                          onClick={() => setCreateAppModal({ courseId: course.id, courseName: course.name, universityId: course.university.id, universityName: course.university.name })}
                          className="rounded border border-blue-300 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
                        >
                          Create Application
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "wishlist" && (
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Student Wishlist</h3>
              {wishlistError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{wishlistError}</div>
              )}
              {wishlistLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-600"><Loader2 className="w-4 h-4 animate-spin" /> Loading wishlist...</div>
              ) : wishlistItems.length === 0 ? (
                <p className="text-sm text-slate-500">No courses saved to wishlist yet.</p>
              ) : (
                <div className="space-y-3">
                  {wishlistItems.map((item) => (
                    <div key={item.courseId} className="rounded-lg border border-slate-200 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{item.courseName}</p>
                          <p className="text-xs text-slate-600">{item.universityName} • {item.universityCountry}</p>
                          <p className="text-xs text-slate-500">{item.courseLevel}</p>
                          <p className="text-xs text-slate-400 mt-1">Added: {new Date(item.addedAt).toLocaleDateString("en-GB")}</p>
                        </div>
                        <div className="text-right text-sm text-slate-700">
                          {item.tuitionFee != null ? `${item.currency} ${item.tuitionFee.toLocaleString()}` : "Fee N/A"}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setCreateAppModal({ courseId: item.courseId, courseName: item.courseName, universityId: item.universityId, universityName: item.universityName })}
                          className="rounded border border-blue-300 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
                        >
                          Create Application
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeFromWishlist(item.courseId)}
                          className="rounded border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                        >
                          Remove from Wishlist
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "mock-interview" && (
            <MockInterviewTab
              listEndpoint={`/api/agent/students/${student.id}/mock-interviews`}
              canAssign={false}
              scope="agent"
            />
          )}

          {tab === "payments" && (
            <StudentPaymentsTab
              studentId={student.id}
              currentUserRole="SUB_AGENT"
            />
          )}

          {tab === "matches" && (
            <div className="bg-white p-6 rounded-lg border border-slate-200">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Course Matches</h3>
              </div>

              {reviewError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{reviewError}</div>
              )}

              <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <input
                  type="text"
                  placeholder="Search by course or university name…"
                  value={matchSearch}
                  onChange={(e) => setMatchSearch(e.target.value)}
                  className="flex-1 min-w-[180px] rounded border border-slate-300 px-3 py-1.5 text-sm"
                />
                <input
                  type="text"
                  placeholder="Filter by country"
                  value={matchCountry}
                  onChange={(e) => setMatchCountry(e.target.value)}
                  className="w-36 rounded border border-slate-300 px-3 py-1.5 text-sm"
                />
                <input
                  type="text"
                  placeholder="Filter by level"
                  value={matchLevel}
                  onChange={(e) => setMatchLevel(e.target.value)}
                  className="w-36 rounded border border-slate-300 px-3 py-1.5 text-sm"
                />
              </div>

              {reviewLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading course matches...
                </div>
              ) : !reviewData || reviewData.matches.length === 0 ? (
                <p className="text-sm text-slate-500">No eligibility matches found yet.</p>
              ) : (
                <div className="space-y-4">
                  {reviewData.matches
                    .filter((match) => {
                      const q = matchSearch.toLowerCase();
                      const matchesSearch = !q ||
                        match.course.name.toLowerCase().includes(q) ||
                        match.course.university.name.toLowerCase().includes(q);
                      const matchesCountry = !matchCountry ||
                        match.course.university.country.toLowerCase().includes(matchCountry.toLowerCase());
                      const matchesLevel = !matchLevel ||
                        match.course.level.toLowerCase().includes(matchLevel.toLowerCase());
                      return matchesSearch && matchesCountry && matchesLevel;
                    })
                    .map((match) => (
                    <div key={match.courseId} className="rounded-lg border border-slate-200 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{match.course.name}</p>
                          <p className="text-xs text-slate-600">{match.course.university.name} • {match.course.university.country}</p>
                        </div>
                        <EligibilityStatusBadge status={toEligibilityStatus(match)} isStaff={true} className="text-right" />
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3 text-sm text-slate-700">
                        <p>Score: <span className="font-semibold">{match.matchScore.toFixed(1)}</span></p>
                        <p className="inline-flex items-center gap-1">
                          {match.overallMet ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-rose-600" />}
                          Overall Threshold
                        </p>
                        <p className="inline-flex items-center gap-1">
                          {match.englishMet === null ? (
                            <span>English: N/A</span>
                          ) : match.englishMet ? (
                            <><CheckCircle2 className="h-4 w-4 text-emerald-600" /> English Met</>
                          ) : (
                            <><XCircle className="h-4 w-4 text-rose-600" /> English Not Met</>
                          )}
                        </p>
                      </div>

                      <div className="mt-3">
                        <label className="mb-1 block text-xs font-medium text-slate-600">Counsellor Note</label>
                        <textarea
                          rows={3}
                          value={noteDrafts[match.courseId] || ""}
                          onChange={(e) =>
                            setNoteDrafts((prev) => ({
                              ...prev,
                              [match.courseId]: e.target.value,
                            }))
                          }
                          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                        />
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={savingNoteCourseId === match.courseId}
                          onClick={() => void saveCounsellorNote(match.courseId)}
                          className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                        >
                          {savingNoteCourseId === match.courseId ? "Saving..." : "Save Note"}
                        </button>

                        {match.matchStatus !== "FULL_MATCH" && !match.overridden && (
                          <button
                            type="button"
                            onClick={() => void markCourseAsEligible(match.courseId)}
                            className="rounded border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                          >
                            Mark as Eligible
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {createAppModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Create Application</h3>
            <div className="mt-3 flex items-center gap-2">
              {[1, 2, 3, 4].map((step) => (
                <div
                  key={step}
                  className={`h-2 flex-1 rounded-full ${createAppStep >= step ? "bg-blue-600" : "bg-slate-200"}`}
                />
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-500">Step {createAppStep} of 4</p>

            <div className="mt-4 space-y-3">
              {createAppStep === 1 && (
                <>
                  <div>
                    <p className="text-xs font-medium text-slate-600">Student</p>
                    <p className="text-sm text-slate-800">{data?.student.fullName || "Student"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-600">University</p>
                    <p className="text-sm text-slate-800">{createAppModal.universityName}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-600">Course</p>
                    <p className="text-sm text-slate-800">{createAppModal.courseName}</p>
                  </div>
                </>
              )}

              {createAppStep === 2 && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Select intake</label>
                  {createAppIntakes.length > 0 ? (
                    <select
                      value={createAppIntake}
                      onChange={(e) => setCreateAppIntake(e.target.value)}
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="">Select intake</option>
                      {createAppIntakes.map((intake) => (
                        <option key={intake} value={intake}>{intake}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="e.g. September 2025"
                      value={createAppIntake}
                      onChange={(e) => setCreateAppIntake(e.target.value)}
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    />
                  )}
                </div>
              )}

              {createAppStep === 3 && (
                <>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={createAppIsUcas} onChange={(e) => setCreateAppIsUcas(e.target.checked)} />
                    UCAS Application
                  </label>
                  <p className="text-xs text-slate-500">
                    If a fee is required, the application remains in Applied until the fee is paid or waived.
                  </p>
                </>
              )}

              {createAppStep === 4 && (
                <>
                  {createAppSuccess && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{createAppSuccess}</div>
                  )}
                  {createAppCreated?.ucasWarning && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                      {createAppCreated.ucasWarning}
                    </div>
                  )}
                  {createAppCreated?.feeRequired && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                      <p className="font-semibold text-slate-900">Application Fee</p>
                      <p className="mt-1">
                        {createAppCreated.amount.toFixed(2)} {createAppCreated.currency} • {(createAppCreated.feeType || "FEE").replaceAll("_", " ")}
                      </p>
                      <p className="mt-1 text-xs">
                        Current status: <span className="font-semibold">{createAppCreated.displayStatus.replaceAll("_", " ")}</span>
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (createAppStep > 1 && createAppStep < 4) {
                    setCreateAppStep((createAppStep - 1) as 1 | 2 | 3 | 4);
                    return;
                  }
                  closeCreateAppModal();
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                {createAppStep > 1 && createAppStep < 4 ? "Back" : "Cancel"}
              </button>
              {createAppStep < 3 && (
                <button
                  type="button"
                  onClick={() => setCreateAppStep((createAppStep + 1) as 1 | 2 | 3 | 4)}
                  disabled={createAppStep === 2 && !createAppIntake.trim()}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Next
                </button>
              )}
              {createAppStep === 3 && (
                <button
                  type="button"
                  disabled={!createAppIntake.trim() || createAppLoading}
                  onClick={() => void createApplicationForStudent()}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {createAppLoading ? "Creating..." : "Create Application"}
                </button>
              )}
              {createAppStep === 4 && createAppCreated?.id && (
                <Link
                  href={`/agent/applications/${createAppCreated.id}`}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  View Application
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {statusModalAppId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Update Application Status</h3>
            <p className="text-xs text-slate-500 mt-1">Sub-agent updates notify counsellor and admin automatically.</p>

            <div className="mt-4 grid gap-3">
              <select value={nextStatus} onChange={(e) => setNextStatus(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">Select status...</option>
                {SUB_AGENT_ALLOWED_STATUSES.map((status) => (
                  <option key={status} value={status}>{APPLICATION_STATUS_LABELS[status] || status}</option>
                ))}
              </select>

              {nextStatus === "CONDITIONAL_OFFER" && (
                <textarea value={offerConditions} onChange={(e) => setOfferConditions(e.target.value)} rows={3} placeholder="Offer conditions" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              )}

              {nextStatus === "UNCONDITIONAL_OFFER" && (
                <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => setOfferLetterFile(e.target.files?.[0] || null)} className="text-sm" />
              )}

              {nextStatus === "CAS_ISSUED" && (
                <input value={casNumber} onChange={(e) => setCasNumber(e.target.value)} placeholder="CAS number" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              )}

              {nextStatus === "VISA_APPLIED" && (
                <div className="grid gap-3 md:grid-cols-2">
                  <input value={visaApplicationRef} onChange={(e) => setVisaApplicationRef(e.target.value)} placeholder="Visa application reference" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  <input value={visaVignetteRef} onChange={(e) => setVisaVignetteRef(e.target.value)} placeholder="Visa vignette reference" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  <select value={visaSubStatus} onChange={(e) => setVisaSubStatus(e.target.value as "VISA_PENDING" | "VISA_APPROVED" | "VISA_REJECTED")} className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2">
                    <option value="VISA_PENDING">{VISA_SUB_STATUS_LABELS.VISA_PENDING}</option>
                    <option value="VISA_APPROVED">{VISA_SUB_STATUS_LABELS.VISA_APPROVED}</option>
                    <option value="VISA_REJECTED">{VISA_SUB_STATUS_LABELS.VISA_REJECTED}</option>
                  </select>
                  {visaSubStatus === "VISA_REJECTED" && (
                    <textarea value={visaRejectionReason} onChange={(e) => setVisaRejectionReason(e.target.value)} rows={3} placeholder="Visa rejection reason" className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2" />
                  )}
                </div>
              )}

              <textarea value={statusNotes} onChange={(e) => setStatusNotes(e.target.value)} rows={3} placeholder="Notes" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setStatusModalAppId(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Cancel</button>
              <button onClick={() => void updateApplicationStatus()} disabled={!nextStatus || savingStatus} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {savingStatus ? "Saving..." : "Confirm Update"}
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

      <LogCallModal
        studentId={student.id}
        studentName={student.fullName}
        isOpen={showLogCallModal}
        onClose={() => setShowLogCallModal(false)}
        entityType="student"
      />

      <FollowUpModal
        entityType="student"
        entityId={student.id}
        entityName={student.fullName}
        isOpen={showFollowUpModal}
        onClose={() => setShowFollowUpModal(false)}
      />

      <QualificationModal
        isOpen={showQualModal}
        onClose={() => setShowQualModal(false)}
        existingData={editingQualification}
        studentId={student.id}
        onSuccess={() => {
          setShowQualModal(false);
          refreshData();
        }}
      />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-slate-800 mt-1">{value || "-"}</p>
    </div>
  );
}
