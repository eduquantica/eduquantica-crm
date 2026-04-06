"use client";

import { useState, useEffect, useCallback } from "react";
import { Session } from "next-auth";
import {
  Loader2,
  Mail,
  Phone,
  MapPin,
  Flag,
  Edit2,
  Phone as CallIcon,
  Clock,
  CheckCircle2,
  XCircle,
  Download,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { LogCallModal } from "@/components/LogCallModal";
import StudyGapIndicator from "@/components/ui/StudyGapIndicator";
import MockInterviewTab from "@/components/MockInterviewTab";
import TestScoresManager from "@/components/student/TestScoresManager";
import QualificationModal from "@/components/student/QualificationModal";
import DocumentPreviewModal from "@/components/shared/DocumentPreviewModal";
import FollowUpModal from "@/components/FollowUpModal";
import EligibilityStatusBadge from "@/components/shared/EligibilityStatusBadge";
import StudentPaymentsTab from "@/components/shared/StudentPaymentsTab";
import { toApiFilesDownloadPath, toApiFilesPath } from "@/lib/file-url";

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  nationality: string | null;
  address: string | null;
  passportNumber: string | null;
  passportExpiry: string | null;
  dateOfBirth: string | null;
  assignedCounsellor: { id: string; name: string | null; email: string } | null;
  subAgent: { id: string; agencyName: string } | null;
  subAgentStaff: { id: string; name: string | null; email: string } | null;
  user: { id: string; email: string; isActive: boolean };
}

interface ReviewDocument {
  id: string;
  type: string;
  fileName: string;
  fileUrl: string;
  status: string;
  uploadedAt: string;
  uploadedAfterApproval: boolean;
  scanResult: {
    id: string;
    status: string;
    plagiarismScore: number | null;
    aiScore: number | null;
    flagColour: string | null;
    counsellorDecision: string | null;
    counsellorNote: string | null;
    reportUrl: string | null;
    isLocked: boolean;
    reviewedAt?: string | null;
  } | null;
}

interface DocumentRequestRow {
  id: string;
  documentType: string;
  documentLabel: string;
  customLabel: string | null;
  notes: string | null;
  requestedBy: string;
  requestedByRole: string;
  requestedByName: string;
  status: string;
  uploadedFileUrl: string | null;
  uploadedFileName: string | null;
  uploadedAt: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
  verificationStatus: string;
  revisionNote: string | null;
  createdAt: string;
  updatedAt: string;
}

interface WrittenReviewDocument {
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
}

interface AcademicSubject {
  id: string;
  subjectName: string;
  rawGrade: string | null;
  gradeType: "GPA" | "LETTER";
  universalScore: number | null;
}

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

interface StudentScholarshipRow {
  id: string;
  status: "INTERESTED" | "APPLIED" | "SHORTLISTED" | "AWARDED" | "REJECTED";
  counsellorNote: string | null;
  notes: string | null;
  awardedAmount: number | null;
  awardLetterUrl: string | null;
  appliedAt: string | null;
  scholarship: {
    id: string;
    name: string;
    amount: number;
    amountType: "FIXED" | "PERCENTAGE";
    percentageOf: "TUITION" | "LIVING" | "TOTAL" | null;
    currency: string;
    deadline: string | null;
    university: { id: string; name: string };
    course: { id: string; name: string } | null;
  };
}

interface AvailableScholarship {
  id: string;
  name: string;
  amount: number;
  amountType: "FIXED" | "PERCENTAGE";
  currency: string;
  deadline: string | null;
  university: { name: string };
  course: { name: string } | null;
}

type DecisionAction = "ACCEPTED" | "REVISION_REQUIRED" | "REJECTED";

type ScanSettings = {
  plagiarismGreenMax: number;
  plagiarismAmberMax: number;
  aiGreenMax: number;
  aiAmberMax: number;
};

interface StudentDetailClientProps {
  initialStudent: Student;
  profileCompletion: number;
  studyGapIndicator: {
    colour: "GREEN" | "YELLOW" | "RED";
    gapYears: number;
    lastQualification: string;
  };
  session: Session;
  userRole: string;
  userId: string;
  latestMockInterviewResult: "PASS" | "FAIL" | null;
}

const ADMIN_UPLOAD_TYPES: Array<{ value: string; label: string }> = [
  { value: "PASSPORT", label: "Passport" },
  { value: "TRANSCRIPT", label: "Academic Transcript" },
  { value: "ENGLISH_TEST", label: "English Test" },
  { value: "FINANCIAL_PROOF", label: "Bank Statement" },
  { value: "PERSONAL_STATEMENT", label: "Personal Statement" },
  { value: "CV", label: "CV" },
  { value: "OTHER", label: "Other" },
];

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

export default function StudentDetailClient({
  initialStudent,
  profileCompletion: initialCompletion,
  studyGapIndicator: initialStudyGapIndicator,
  userRole,
  userId,
  latestMockInterviewResult,
}: StudentDetailClientProps) {
  const [student, setStudent] = useState<Student>(initialStudent);
  const [completion, setCompletion] = useState(initialCompletion);
  const [studyGapIndicator, setStudyGapIndicator] = useState(initialStudyGapIndicator);
  const [editing, setEditing] = useState(false);
  const [staffEditMode, setStaffEditMode] = useState(false);
  const [formData, setFormData] = useState({
    firstName: student.firstName,
    lastName: student.lastName,
    email: student.email,
    phone: student.phone || "",
    nationality: student.nationality || "",
    address: student.address || "",
    passportNumber: student.passportNumber || "",
    passportExpiry: student.passportExpiry || "",
    dateOfBirth: student.dateOfBirth || "",
    assignedCounsellorId: student.assignedCounsellor?.id || "",
    subAgentId: student.subAgent?.id || "",
    subAgentStaffId: student.subAgentStaff?.id || "",
  });
  const [saving, setSaving] = useState(false);
  const [showLogCallModal, setShowLogCallModal] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [docSummary, setDocSummary] = useState<{
    pendingUpload: number;
    uploadedScanning: number;
    needsRevision: number;
    verified: number;
    flaggedHigh: number;
    allReady: boolean;
    checklistId?: string | null;
    allChecklistItemsVerified?: boolean;
    certificateAlreadyGenerated?: boolean;
    verificationRef?: string | null;
  } | null>(null);
  const [documents, setDocuments] = useState<ReviewDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [hasActiveMobileUpload, setHasActiveMobileUpload] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rescanLoadingId, setRescanLoadingId] = useState<string | null>(null);
  const [unlockLoadingId, setUnlockLoadingId] = useState<string | null>(null);
  const [unlockTarget, setUnlockTarget] = useState<ReviewDocument | null>(null);
  const [unlockReason, setUnlockReason] = useState("");
  const [scanSettings, setScanSettings] = useState<ScanSettings>({
    plagiarismGreenMax: 15,
    plagiarismAmberMax: 30,
    aiGreenMax: 20,
    aiAmberMax: 40,
  });
  const [activeScanDoc, setActiveScanDoc] = useState<ReviewDocument | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ fileName: string; fileUrl: string } | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadType, setUploadType] = useState("PASSPORT");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadNotes, setUploadNotes] = useState("");
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [decisionAction, setDecisionAction] = useState<DecisionAction | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [passportDecisionLoadingId, setPassportDecisionLoadingId] = useState<string | null>(null);
    const [documentRequests, setDocumentRequests] = useState<DocumentRequestRow[]>([]);
    const [requestLoading, setRequestLoading] = useState(false);
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [requestDocumentName, setRequestDocumentName] = useState("");
    const [requestNotes, setRequestNotes] = useState("");
    const [requestSubmitting, setRequestSubmitting] = useState(false);
    const [requestActionLoadingId, setRequestActionLoadingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"profile" | "documents" | "written" | "academic" | "matches" | "wishlist" | "applications" | "scholarships" | "mock-interview" | "cv-builder" | "payments">("profile");
  const [writtenDocuments, setWrittenDocuments] = useState<WrittenReviewDocument[]>([]);
  const [writtenLoading, setWrittenLoading] = useState(false);
  const [writtenActionLoadingId, setWrittenActionLoadingId] = useState<string | null>(null);
  const [activeWrittenDoc, setActiveWrittenDoc] = useState<WrittenReviewDocument | null>(null);
  const [reviewData, setReviewData] = useState<EligibilityReviewData | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [academicEditMode, setAcademicEditMode] = useState(false);
  const [showQualModal, setShowQualModal] = useState(false);
  const [editingQualification, setEditingQualification] = useState<AcademicQualification | null>(null);
  const [subjectDrafts, setSubjectDrafts] = useState<Record<string, { rawGrade: string; gradeType: "GPA" | "LETTER" }>>({});
  const [savingSubjectId, setSavingSubjectId] = useState<string | null>(null);
  const [academicActionLoading, setAcademicActionLoading] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [savingNoteCourseId, setSavingNoteCourseId] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [scholarshipRows, setScholarshipRows] = useState<StudentScholarshipRow[]>([]);
  const [availableScholarships, setAvailableScholarships] = useState<AvailableScholarship[]>([]);
  const [scholarshipError, setScholarshipError] = useState<string | null>(null);
  const [scholarshipLoading, setScholarshipLoading] = useState(false);
  const [selectedScholarshipId, setSelectedScholarshipId] = useState("");
  const [newScholarshipStatus, setNewScholarshipStatus] = useState<"INTERESTED" | "APPLIED" | "SHORTLISTED" | "AWARDED" | "REJECTED">("INTERESTED");
  const [newScholarshipNotes, setNewScholarshipNotes] = useState("");
  const [savingScholarship, setSavingScholarship] = useState<string | null>(null);
  const [scholarshipDrafts, setScholarshipDrafts] = useState<Record<string, {
    status: "INTERESTED" | "APPLIED" | "SHORTLISTED" | "AWARDED" | "REJECTED";
    counsellorNote: string;
    awardedAmount: string;
    awardLetterUrl: string;
  }>>({});
  // Wishlist tab
  const [wishlistItems, setWishlistItems] = useState<Array<{ courseId: string; courseName: string; courseLevel: string; universityId: string; universityName: string; universityCountry: string; tuitionFee: number | null; currency: string; addedAt: string; }>>([]);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [wishlistError, setWishlistError] = useState<string | null>(null);
  // Applications list tab
  const [studentApplicationsList, setStudentApplicationsList] = useState<Array<{ id: string; status: string; createdAt: string; course: { name: string } | null; university: { name: string } | null; }>>([]);
  const [appsListLoading, setAppsListLoading] = useState(false);
  const [appsListError, setAppsListError] = useState<string | null>(null);
  // Declarations in Documents tab
  const [declarations, setDeclarations] = useState<Array<{ id: string; applicationId: string | null; signatureName: string; signedAt: string; createdAt: string; }>>([]);
  const [declarationsLoading, setDeclarationsLoading] = useState(false);
  // Create Application modal
  const [createAppModal, setCreateAppModal] = useState<{ courseId: string; courseName: string; universityId: string; universityName: string; intakes?: string[] } | null>(null);
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
  // Matches tab search/filter
  const [matchSearch, setMatchSearch] = useState("");
  const [matchCountry, setMatchCountry] = useState("");
  const [matchLevel, setMatchLevel] = useState("");
  const isCounsellor = userRole === "COUNSELLOR";
  const isAdmin = userRole === "ADMIN";
  const canReviewScan = userRole === "ADMIN" || userRole === "COUNSELLOR";
  const canEdit =
    userRole === "ADMIN" ||
    userRole === "MANAGER" ||
    (isCounsellor && student.assignedCounsellor?.id === userId);
  const canMutateStudent = canEdit && staffEditMode;

  useEffect(() => {
    if (staffEditMode) {
      setAcademicEditMode(true);
      return;
    }

    setEditing(false);
    setAcademicEditMode(false);
    setEditingSubjectId(null);
  }, [staffEditMode]);

  // Fetch intakes when create app modal opens
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
          setCreateAppIntake(intakes[0]); // auto-select first intake
        }
      } catch (err) {
        console.error("Failed to fetch intakes:", err);
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

  // fetch counsellors and subagents similar to lead page
  const { data: counsellorsData } = useQuery({
    queryKey: ["counsellors"],
    queryFn: async () => {
      const res = await fetch("/api/admin/settings/users?role=COUNSELLOR");
      if (!res.ok) throw new Error("Failed to fetch counsellors");
      return res.json();
    },
  });
  const counsellors: Array<{ id: string; name: string | null }> =
    counsellorsData?.data?.users || [];

  const { data: subAgentsData } = useQuery({
    queryKey: ["subAgents"],
    queryFn: async () => {
      const res = await fetch("/api/admin/sub-agents/list?status=approved");
      if (!res.ok) throw new Error("Failed to fetch sub-agents");
      return res.json();
    },
  });
  const subAgents: Array<{ id: string; agencyName: string }> =
    subAgentsData?.data?.subAgents || [];

  const { data: subAgentTeamData } = useQuery({
    queryKey: ["subAgentTeam", formData.subAgentId],
    queryFn: async () => {
      if (!formData.subAgentId) return { data: { team: [] } };
      const res = await fetch(`/api/admin/sub-agents/${formData.subAgentId}/team`);
      if (!res.ok) throw new Error("Failed to fetch sub-agent team");
      return res.json();
    },
    enabled: !!formData.subAgentId,
  });
  const subAgentTeam: Array<{ id: string; name: string; email: string; isActive: boolean }> =
    subAgentTeamData?.data?.team || [];

  function formatDate(iso: string | null) {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-GB");
  }

  const fetchDocuments = useCallback(async () => {
    setDocumentsLoading(true);
    try {
      const res = await fetch(`/api/admin/students/${student.id}/documents`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch documents");
      }
      const { data } = await res.json();
      setDocuments(data || []);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to fetch documents");
    } finally {
      setDocumentsLoading(false);
    }
  }, [student.id]);
  const fetchDocumentRequests = useCallback(async () => {
    setRequestLoading(true);
    try {
      const res = await fetch(`/api/admin/students/${student.id}/document-requests`, { cache: "no-store" });
      const json = await res.json() as { data?: DocumentRequestRow[]; error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to fetch document requests");
      setDocumentRequests(json.data || []);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to fetch document requests");
    } finally {
      setRequestLoading(false);
    }
  }, [student.id]);

  const fetchWrittenDocuments = useCallback(async () => {
    setWrittenLoading(true);
    try {
      const res = await fetch(`/api/counsellor/students/${student.id}/documents/written`, { cache: "no-store" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch written documents");
      }
      const { data } = await res.json();
      setWrittenDocuments(data || []);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to fetch written documents");
    } finally {
      setWrittenLoading(false);
    }
  }, [student.id]);

  async function handleWrittenDecision(documentId: string, action: "APPROVE" | "REJECT") {
    const reason = action === "REJECT" ? window.prompt("Enter rejection reason") || "" : "";
    if (action === "REJECT" && !reason.trim()) {
      setActionError("Rejection reason is required.");
      return;
    }

    setWrittenActionLoadingId(documentId);
    setActionError(null);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/counsellor/students/${student.id}/documents/written/${documentId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: reason.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to update document status");
      }
      setActionMessage(action === "APPROVE" ? "Written document approved." : "Written document rejected.");
      await fetchWrittenDocuments();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update written document");
    } finally {
      setWrittenActionLoadingId(null);
    }
  }

  const fetchScanSettings = useCallback(async () => {
    if (!canReviewScan) return;
    try {
      const res = await fetch("/api/admin/settings/scan");
      if (!res.ok) return;
      const { data } = await res.json();
      if (data) setScanSettings(data);
    } catch {
      // ignore settings fetch errors in UI
    }
  }, [canReviewScan]);

  function isScanEligible(type: string) {
    return type === "SOP" || type === "PERSONAL_STATEMENT" || type === "COVER_LETTER" || type === "LOR";
  }

  function scoreTone(score: number | null | undefined, greenMax: number, amberMax: number) {
    const value = score ?? 0;
    if (value > amberMax) return "bg-red-500";
    if (value > greenMax) return "bg-amber-500";
    return "bg-emerald-500";
  }

  function scanBadge(doc: ReviewDocument): { label: string; className: string; spinning?: boolean } {
    if (!isScanEligible(doc.type)) {
      return { label: "-", className: "bg-slate-100 text-slate-600" };
    }

    const scan = doc.scanResult;
    if (!scan || scan.status === "PENDING") {
      return { label: "Under Review", className: "bg-slate-100 text-slate-700" };
    }

    if (scan.status === "SCANNING") {
      return { label: "Scanning in progress", className: "bg-blue-100 text-blue-700", spinning: true };
    }

    if (scan.flagColour === "GREEN") {
      return { label: "Passed", className: "bg-emerald-100 text-emerald-700" };
    }
    if (scan.flagColour === "AMBER") {
      return { label: "Review Required", className: "bg-amber-100 text-amber-700" };
    }
    if (scan.flagColour === "RED") {
      return { label: "High Risk", className: "bg-red-100 text-red-700" };
    }

    return { label: "Under Review", className: "bg-slate-100 text-slate-700" };
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

  async function handleRescan(documentId: string) {
    setActionMessage(null);
    setActionError(null);
    setRescanLoadingId(documentId);
    try {
      const res = await fetch(`/api/admin/documents/${documentId}/rescan`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to trigger re-scan");
      }
      setActionMessage("Re-scan triggered successfully.");
      await fetchDocuments();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to trigger re-scan");
    } finally {
      setRescanLoadingId(null);
    }
  }

  async function deleteDocument(documentId: string) {
    if (!canMutateStudent) {
      setActionError("Enable Edit Mode to delete documents.");
      return;
    }

    const confirmed = window.confirm("Are you sure you want to delete this document?");
    if (!confirmed) return;

    setActionError(null);
    setActionMessage(null);

    try {
      const res = await fetch(`/api/documents/${documentId}`, { method: "DELETE" });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        throw new Error(json.error || "Failed to delete document");
      }

      setDocuments((current) => current.filter((doc) => doc.id !== documentId));
      setActionMessage("Document deleted successfully.");
      await fetchDocuments();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete document");
    }
  }

  async function submitDocumentRequest() {
    if (!canMutateStudent) {
      setActionError("Enable Edit Mode to request documents.");
      return;
    }

    const label = requestDocumentName.trim();
    if (!label) {
      setActionError("Document name is required.");
      return;
    }

    setRequestSubmitting(true);
    setActionError(null);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/admin/students/${student.id}/document-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentLabel: label,
          notes: requestNotes.trim() || null,
        }),
      });
      const json = await res.json() as { data?: DocumentRequestRow; error?: string };
      if (!res.ok || !json.data) throw new Error(json.error || "Failed to create request");

      setDocumentRequests((prev) => [json.data as DocumentRequestRow, ...prev]);
      setRequestDocumentName("");
      setRequestNotes("");
      setShowRequestModal(false);
      setActionMessage("Document request created.");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to create request");
    } finally {
      setRequestSubmitting(false);
    }
  }

  async function updateDocumentRequest(requestId: string, action: "VERIFY" | "REQUEST_REVISION") {
    if (!canMutateStudent) {
      setActionError("Enable Edit Mode to review requested documents.");
      return;
    }

    const note = action === "REQUEST_REVISION"
      ? (window.prompt("Add revision note", "Please re-upload a clearer file.") || "").trim()
      : "";

    if (action === "REQUEST_REVISION" && !note) {
      setActionError("Revision note is required.");
      return;
    }

    setRequestActionLoadingId(requestId);
    setActionError(null);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/admin/students/${student.id}/document-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: note || undefined }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to update request");

      await fetchDocumentRequests();
      setActionMessage(action === "VERIFY" ? "Requested document verified." : "Revision requested from student.");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update request");
    } finally {
      setRequestActionLoadingId(null);
    }
  }

  async function deleteDocumentRequest(requestId: string) {
    if (!canMutateStudent) {
      setActionError("Enable Edit Mode to delete requests.");
      return;
    }

    const confirmed = window.confirm("Delete this document request?");
    if (!confirmed) return;

    setRequestActionLoadingId(requestId);
    setActionError(null);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/admin/students/${student.id}/document-requests/${requestId}`, {
        method: "DELETE",
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to delete request");
      setDocumentRequests((prev) => prev.filter((row) => row.id !== requestId));
      setActionMessage("Document request deleted.");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete request");
    } finally {
      setRequestActionLoadingId(null);
    }
  }

  async function uploadDocumentAsAdmin() {
    if (!canMutateStudent) {
      setActionError("Enable Edit Mode to upload documents.");
      return;
    }

    if (!uploadFile) {
      setActionError("Please choose a file to upload.");
      return;
    }

    try {
      setUploadingDocument(true);
      setActionError(null);
      setActionMessage(null);

      const formData = new FormData();
      formData.append("files", uploadFile);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      const uploadJson = await uploadRes.json() as { urls?: string[]; error?: string };
      if (!uploadRes.ok || !uploadJson.urls?.[0]) {
        throw new Error(uploadJson.error || "Upload failed");
      }

      const saveRes = await fetch(`/api/admin/students/${student.id}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: uploadType,
          fileName: uploadFile.name,
          fileUrl: uploadJson.urls[0],
          notes: uploadNotes.trim() || null,
        }),
      });
      const saveJson = await saveRes.json() as { data?: ReviewDocument; error?: string };
      if (!saveRes.ok || !saveJson.data) {
        throw new Error(saveJson.error || "Failed to save document");
      }

      setDocuments((current) => [saveJson.data as ReviewDocument, ...current]);
      setActionMessage("Document uploaded successfully.");
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadNotes("");
      setUploadType("PASSPORT");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to upload document");
    } finally {
      setUploadingDocument(false);
    }
  }

  async function generateChecklistCertificate() {
    if (!docSummary?.checklistId) {
      setActionError("Checklist is not ready for certificate generation.");
      return;
    }

    setActionError(null);
    setActionMessage(null);
    setActionMessage("Generating certificate...");
    try {
      const res = await fetch(`/api/admin/checklists/${docSummary.checklistId}/generate-certificate`, {
        method: "POST",
      });
      const json = await res.json() as { data?: { verificationRef?: string }; error?: string };
      if (!res.ok) {
        throw new Error(json.error || "Failed to generate certificate");
      }

      setActionMessage(`Certificate generated (${json.data?.verificationRef || "N/A"}).`);
      const summaryRes = await fetch(`/api/admin/students/${student.id}/documents/summary`, { cache: "no-store" });
      if (summaryRes.ok) {
        const summaryJson = await summaryRes.json();
        setDocSummary(summaryJson.data);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to generate certificate");
      setActionMessage(null);
    }
  }

  async function submitUnlock() {
    if (!unlockTarget) return;
    const reason = unlockReason.trim();
    if (!reason) {
      setActionError("Unlock reason is required.");
      return;
    }

    setActionMessage(null);
    setActionError(null);
    setUnlockLoadingId(unlockTarget.id);

    try {
      const res = await fetch(`/api/admin/documents/${unlockTarget.id}/unlock-scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to unlock scan");
      }

      setActionMessage("Scan unlocked successfully. Re-scan is now enabled.");
      setUnlockTarget(null);
      setUnlockReason("");
      await fetchDocuments();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to unlock scan");
    } finally {
      setUnlockLoadingId(null);
    }
  }

  async function submitDecision(action: DecisionAction) {
    if (!activeScanDoc) return;
    const note = decisionNote.trim();

    if ((action === "REVISION_REQUIRED" || action === "REJECTED") && !note) {
      setActionError(action === "REJECTED" ? "Rejection reason is required." : "Revision note is required.");
      return;
    }

    setActionMessage(null);
    setActionError(null);
    setDecisionLoading(true);

    try {
      const res = await fetch(`/api/admin/documents/${activeScanDoc.id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: action, note: note || undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save decision");
      }

      setActionMessage(`Decision saved: ${action.replaceAll("_", " ")}.`);
      setDecisionAction(null);
      setDecisionNote("");
      setActiveScanDoc(null);
      await fetchDocuments();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to save decision");
    } finally {
      setDecisionLoading(false);
    }
  }

  async function handlePassportDecision(docId: string, decision: "ACCEPTED" | "REVISION_REQUIRED" | "REJECTED") {
    const note =
      decision === "REVISION_REQUIRED" || decision === "REJECTED"
        ? (window.prompt(decision === "REJECTED" ? "Enter rejection reason:" : "Add revision note:") || "").trim()
        : "";

    if ((decision === "REVISION_REQUIRED" || decision === "REJECTED") && !note) {
      setActionError(decision === "REJECTED" ? "Rejection reason is required." : "Revision note is required.");
      return;
    }

    setPassportDecisionLoadingId(docId);
    setActionError(null);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/admin/documents/${docId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note: note || undefined }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to save decision");
      setActionMessage(
        decision === "ACCEPTED"
          ? "Passport verified."
          : decision === "REVISION_REQUIRED"
          ? "Revision requested from student."
          : "Passport rejected.",
      );
      await fetchDocuments();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update passport");
    } finally {
      setPassportDecisionLoadingId(null);
    }
  }

  const fetchEligibilityReview = useCallback(async () => {
    setReviewLoading(true);
    setReviewError(null);
    try {
      const res = await fetch(`/api/admin/students/${student.id}/eligibility-review`, {
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
  }, [student.id]);

  const refreshData = useCallback(() => {
    void fetchEligibilityReview();
  }, [fetchEligibilityReview]);

  async function fetchWishlist() {
    setWishlistLoading(true);
    setWishlistError(null);
    try {
      const res = await fetch(`/api/students/${student.id}/wishlist`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load wishlist");
      setWishlistItems(json.data || []);
    } catch (err) {
      setWishlistError(err instanceof Error ? err.message : "Failed to load wishlist");
    } finally {
      setWishlistLoading(false);
    }
  }

  async function addToWishlist(courseId: string) {
    try {
      const res = await fetch(`/api/students/${student.id}/wishlist`, {
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
      const res = await fetch(`/api/students/${student.id}/wishlist/${courseId}`, { method: "DELETE" });
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

  async function fetchStudentApplicationsList() {
    setAppsListLoading(true);
    setAppsListError(null);
    try {
      const res = await fetch(`/api/dashboard/applications?studentId=${student.id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load applications");
      setStudentApplicationsList(json.data || []);
    } catch (err) {
      setAppsListError(err instanceof Error ? err.message : "Failed to load applications");
    } finally {
      setAppsListLoading(false);
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
          studentId: student.id,
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
      // Refresh applications list and switch to Applications tab
      await fetchStudentApplicationsList();
      setActiveTab("applications");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create application");
    } finally {
      setCreateAppLoading(false);
    }
  }

  async function saveSubject(subjectId: string) {
    if (!canMutateStudent) {
      setReviewError("Enable Edit Mode to update grades.");
      return;
    }

    const draft = subjectDrafts[subjectId];
    if (!draft) return;

    setSavingSubjectId(subjectId);
    setReviewError(null);
    try {
      const qualification = reviewData?.qualifications.find((row) => row.subjects.some((subject) => subject.id === subjectId));
      if (!qualification) {
        throw new Error("Qualification not found for subject");
      }

      const res = await fetch(`/api/qualifications/${qualification.id}/subjects/${subjectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grade: draft.rawGrade,
          gradeType: draft.gradeType,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to save grade");
      }

      setReviewData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          qualifications: prev.qualifications.map((qualificationRow) => ({
            ...qualificationRow,
            subjects: qualificationRow.subjects.map((subjectRow) =>
              subjectRow.id === subjectId
                ? {
                    ...subjectRow,
                    rawGrade: draft.rawGrade,
                    gradeType: draft.gradeType,
                  }
                : subjectRow,
            ),
          })),
        };
      });
      setEditingSubjectId(null);
      toast.success("Grade updated");
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "Failed to save grade");
    } finally {
      setSavingSubjectId(null);
    }
  }

  async function addQualification() {
    if (!canMutateStudent) {
      setReviewError("Enable Edit Mode to add qualifications.");
      return;
    }
    setEditingQualification(null);
    setReviewError(null);
    setShowQualModal(true);
  }

  async function editQualification(qualification: AcademicQualification) {
    if (!canMutateStudent) {
      setReviewError("Enable Edit Mode to edit qualifications.");
      return;
    }
    setEditingQualification(qualification);
    setReviewError(null);
    setShowQualModal(true);
  }

  async function deleteQualification(qualificationId: string) {
    if (!canMutateStudent) {
      setReviewError("Enable Edit Mode to delete qualifications.");
      return;
    }

    if (!window.confirm("Delete this qualification and all its subjects?")) return;

    setAcademicActionLoading(`delete-qualification-${qualificationId}`);
    setReviewError(null);
    try {
      const res = await fetch(`/api/qualifications/${qualificationId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to delete qualification");

      await fetchEligibilityReview();
      toast.success("Qualification deleted");
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "Failed to delete qualification");
    } finally {
      setAcademicActionLoading(null);
    }
  }

  async function addSubject(qualificationId: string) {
    if (!canMutateStudent) {
      setReviewError("Enable Edit Mode to add subjects.");
      return;
    }

    const subjectName = (window.prompt("Subject name") || "").trim();
    if (!subjectName) return;

    const gradeTypeInput = (window.prompt("Grade type (GPA or LETTER)", "LETTER") || "LETTER").trim().toUpperCase();
    if (gradeTypeInput !== "GPA" && gradeTypeInput !== "LETTER") {
      setReviewError("Grade type must be GPA or LETTER.");
      return;
    }

    const grade = (window.prompt("Grade (optional)") || "").trim();

    setAcademicActionLoading(`create-subject-${qualificationId}`);
    setReviewError(null);
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
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to add subject");

      await fetchEligibilityReview();
      toast.success("Subject added");
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "Failed to add subject");
    } finally {
      setAcademicActionLoading(null);
    }
  }

  async function deleteSubject(qualificationId: string, subjectId: string) {
    if (!canMutateStudent) {
      setReviewError("Enable Edit Mode to delete subjects.");
      return;
    }

    if (!window.confirm("Delete this subject?")) return;

    setAcademicActionLoading(`delete-subject-${subjectId}`);
    setReviewError(null);
    try {
      const res = await fetch(`/api/qualifications/${qualificationId}/subjects/${subjectId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to delete subject");

      await fetchEligibilityReview();
      toast.success("Subject deleted");
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "Failed to delete subject");
    } finally {
      setAcademicActionLoading(null);
    }
  }

  async function saveCounsellorNote(courseId: string) {
    if (!canMutateStudent) {
      setReviewError("Enable Edit Mode to update notes.");
      return;
    }

    setSavingNoteCourseId(courseId);
    setReviewError(null);
    try {
      const res = await fetch(`/api/admin/students/${student.id}/course-matches/${courseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ counsellorFlagNote: (noteDrafts[courseId] || "").trim() || null }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to save counsellor note");
      }
      await fetchEligibilityReview();
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "Failed to save counsellor note");
    } finally {
      setSavingNoteCourseId(null);
    }
  }

  async function markCourseAsEligible(courseId: string) {
    if (!canMutateStudent) {
      setReviewError("Enable Edit Mode to mark eligibility.");
      return;
    }

    if (!window.confirm("This student is currently Not Eligible or Partially Eligible for this course. Mark as Eligible manually?")) return;

    try {
      const res = await fetch(`/api/admin/students/${student.id}/course-matches/${courseId}`, {
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

  async function removeEligibilityOverride(courseId: string) {
    if (!(userRole === "ADMIN" || userRole === "MANAGER")) {
      setReviewError("Only Admin or Manager can remove overrides.");
      return;
    }

    if (!window.confirm("Remove manual eligibility override?")) return;

    try {
      const res = await fetch(`/api/admin/students/${student.id}/course-matches/${courseId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to remove override");
      await fetchEligibilityReview();
      toast.success("Eligibility override removed");
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "Failed to remove override");
    }
  }

  async function downloadEligibilityReport(courseId?: string) {
    setPdfLoading(true);
    setReviewError(null);
    try {
      const query = courseId ? `?courseId=${encodeURIComponent(courseId)}` : "";
      const res = await fetch(`/api/admin/students/${student.id}/eligibility-report${query}`);
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to generate PDF report");
      }

      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `eligibility-report-${student.firstName}-${student.lastName}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "Failed to generate PDF report");
    } finally {
      setPdfLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    if (!canMutateStudent) {
      alert("Enable Edit Mode to save profile changes.");
      return;
    }

    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/students/${student.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }
      const { data } = await res.json();
      setStudent(data.student);
      setEditing(false);
      // recalc completion if provided
      if (data.profileCompletion !== undefined) {
        setCompletion(data.profileCompletion);
      }
      if (data.studyGapIndicator) {
        setStudyGapIndicator(data.studyGapIndicator);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error saving student");
    } finally {
      setSaving(false);
    }
  }

  const fetchScholarships = useCallback(async () => {
    setScholarshipLoading(true);
    setScholarshipError(null);
    try {
      const res = await fetch(`/api/admin/students/${student.id}/scholarships`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to load scholarships");
      }

      const rows = (json.data?.rows || []) as StudentScholarshipRow[];
      setScholarshipRows(rows);
      setAvailableScholarships((json.data?.availableScholarships || []) as AvailableScholarship[]);

      const nextDrafts: Record<string, {
        status: "INTERESTED" | "APPLIED" | "SHORTLISTED" | "AWARDED" | "REJECTED";
        counsellorNote: string;
        awardedAmount: string;
        awardLetterUrl: string;
      }> = {};
      for (const row of rows) {
        nextDrafts[row.id] = {
          status: row.status,
          counsellorNote: row.counsellorNote || "",
          awardedAmount: row.awardedAmount != null ? String(row.awardedAmount) : "",
          awardLetterUrl: row.awardLetterUrl || "",
        };
      }
      setScholarshipDrafts(nextDrafts);
    } catch (err) {
      setScholarshipError(err instanceof Error ? err.message : "Failed to load scholarships");
    } finally {
      setScholarshipLoading(false);
    }
  }, [student.id]);

  async function addScholarshipTrackerItem() {
    if (!canMutateStudent) {
      setScholarshipError("Enable Edit Mode to add scholarship items.");
      return;
    }

    if (!selectedScholarshipId) {
      setScholarshipError("Select a scholarship first");
      return;
    }

    setSavingScholarship("new");
    setScholarshipError(null);
    try {
      const res = await fetch(`/api/admin/students/${student.id}/scholarships`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scholarshipId: selectedScholarshipId,
          status: newScholarshipStatus,
          notes: newScholarshipNotes.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to add scholarship item");
      }
      setSelectedScholarshipId("");
      setNewScholarshipStatus("INTERESTED");
      setNewScholarshipNotes("");
      await fetchScholarships();
    } catch (err) {
      setScholarshipError(err instanceof Error ? err.message : "Failed to add scholarship item");
    } finally {
      setSavingScholarship(null);
    }
  }

  async function updateScholarshipItem(applicationId: string) {
    if (!canMutateStudent) {
      setScholarshipError("Enable Edit Mode to update scholarship items.");
      return;
    }

    const draft = scholarshipDrafts[applicationId];
    if (!draft) return;

    setSavingScholarship(applicationId);
    setScholarshipError(null);
    try {
      const res = await fetch(`/api/admin/students/${student.id}/scholarships/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: draft.status,
          counsellorNote: draft.counsellorNote.trim() || null,
          awardedAmount: draft.awardedAmount ? Number(draft.awardedAmount) : null,
          awardLetterUrl: draft.awardLetterUrl.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to update scholarship item");
      }
      await fetchScholarships();
    } catch (err) {
      setScholarshipError(err instanceof Error ? err.message : "Failed to update scholarship item");
    } finally {
      setSavingScholarship(null);
    }
  }

  // fetch document checklist summary
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`/api/admin/students/${student.id}/documents/summary`);
        if (!res.ok) return;
        const { data } = await res.json();
        if (mounted) setDocSummary(data);
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, [student.id]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    fetchScanSettings();
  }, [fetchScanSettings]);

  useEffect(() => {
    if (activeTab !== "written") return;
    void fetchWrittenDocuments();
  }, [activeTab, fetchWrittenDocuments]);

  useEffect(() => {
    if (activeTab !== "academic" && activeTab !== "matches") return;
    fetchEligibilityReview();
  }, [activeTab, fetchEligibilityReview]);

  useEffect(() => {
    if (activeTab !== "wishlist") return;
    fetchWishlist();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "applications") return;
    fetchStudentApplicationsList();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "scholarships") return;
    fetchScholarships();
  }, [activeTab, fetchScholarships]);

  useEffect(() => {
    if (activeTab !== "documents") return;

    let mounted = true;
    const refresh = async () => {
      try {
        const res = await fetch(`/api/mobile-upload/session/active?studentId=${encodeURIComponent(student.id)}`, { cache: "no-store" });
        const json = await res.json() as { hasActiveSession?: boolean };
        if (mounted) {
          setHasActiveMobileUpload(Boolean(json.hasActiveSession));
        }
      } catch {
        if (mounted) setHasActiveMobileUpload(false);
      }
    };

    void refresh();
    const interval = setInterval(() => {
      void refresh();
    }, 3000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [activeTab, student.id]);
  useEffect(() => {
    if (activeTab !== "documents") return;
    void fetchDocumentRequests();
  }, [activeTab, fetchDocumentRequests]);

  useEffect(() => {
    if (activeTab !== "documents") return;
    setDeclarationsLoading(true);
    fetch(`/api/student/declarations?studentId=${student.id}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => { setDeclarations(json.data || []); })
      .catch(() => { setDeclarations([]); })
      .finally(() => { setDeclarationsLoading(false); });
  }, [activeTab, student.id]);

  return (
    <div className="space-y-5 p-1 md:p-2">
      <div className="mb-6">
        <Link
          href="/dashboard/students"
          className="portal-btn-ghost text-sm"
        >
          ← Back to Students
        </Link>
      </div>

      {/* Document checklist summary card (below header) */}
      {docSummary && (
        <div className="mb-4">
          {docSummary.allReady && (
            <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              File Ready to Submit — all required documents verified
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="portal-shell-card p-3 text-sm">
              <div className="text-xs text-slate-500">Pending upload</div>
              <div className="font-semibold text-slate-800">{docSummary.pendingUpload}</div>
            </div>
            <div className="portal-shell-card p-3 text-sm">
              <div className="text-xs text-slate-500">Uploaded, scanning</div>
              <div className="font-semibold text-slate-800">{docSummary.uploadedScanning}</div>
            </div>
            <div className="portal-shell-card p-3 text-sm">
              <div className="text-xs text-slate-500">Needs revision</div>
              <div className="font-semibold text-amber-600">{docSummary.needsRevision}</div>
            </div>
            <div className="portal-shell-card p-3 text-sm">
              <div className="text-xs text-slate-500">Verified</div>
              <div className="font-semibold text-emerald-600">{docSummary.verified}</div>
            </div>
            <div className="portal-shell-card p-3 text-sm">
              <div className="text-xs text-slate-500">Flagged HIGH risk</div>
              <div className="font-semibold text-red-600">{docSummary.flaggedHigh}</div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* summary card */}
        <div className="lg:col-span-1">
          <div className="portal-shell-card sticky top-6 p-6">
            <h1 className="text-2xl font-bold text-slate-900 mb-1">
              <span className="inline-flex items-center gap-2">
                <span>{student.firstName} {student.lastName}</span>
                <StudyGapIndicator colour={studyGapIndicator.colour} size="md" />
                {latestMockInterviewResult && (
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      latestMockInterviewResult === "PASS"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-rose-100 text-rose-700"
                    }`}
                  >
                    Mock Interview {latestMockInterviewResult}
                  </span>
                )}
              </span>
            </h1>
            <p className="text-sm text-slate-500 mb-4">
              EQ-STU-{student.id}
            </p>
            <div className="mb-4">
              <span className="text-xs text-slate-600">Profile completion</span>
              <div className="w-full bg-slate-200 h-2 rounded mt-1">
                <div
                  className="h-2 bg-green-500 rounded"
                  style={{ width: `${completion}%` }}
                />
              </div>
              <span className="text-xs text-slate-600">{completion}%</span>
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/dashboard/cv-builder?studentId=${student.id}`}
                  className="portal-btn-accent inline-flex items-center px-3 py-1.5 text-xs"
                >
                  Download CV
                </Link>
                <Link
                  href={`/dashboard/cv-builder?studentId=${student.id}`}
                  className="portal-btn-ghost inline-flex items-center px-3 py-1.5 text-xs"
                >
                  Edit CV
                </Link>
              </div>

              {student.email && (
                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-slate-400 mt-1" />
                  <a
                    href={`mailto:${student.email}`}
                    className="text-sm text-blue-600 hover:underline break-all"
                  >
                    {student.email}
                  </a>
                </div>
              )}
              {student.phone && (
                <div className="flex items-start gap-3">
                  <Phone className="w-4 h-4 text-slate-400 mt-1" />
                  <span className="text-sm">{student.phone}</span>
                </div>
              )}
              {student.nationality && (
                <div className="flex items-start gap-3">
                  <Flag className="w-4 h-4 text-slate-400 mt-1" />
                  <span className="text-sm">{student.nationality}</span>
                </div>
              )}
              {student.address && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-slate-400 mt-1" />
                  <span className="text-sm break-words">{student.address}</span>
                </div>
              )}
              {student.assignedCounsellor && (
                <div className="mt-4">
                  <p className="text-xs text-slate-500 uppercase">Counsellor</p>
                  <p className="text-sm">{student.assignedCounsellor.name}</p>
                </div>
              )}
              {student.subAgent && (
                <div className="mt-2">
                  <p className="text-xs text-slate-500 uppercase">Sub-agent</p>
                  <span className="inline-block bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">
                    {student.subAgent.agencyName}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="portal-shell-card mb-4 border-b border-[var(--eq-border)] px-4 pt-3">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex flex-wrap gap-4">
                {[
                  { id: "profile", label: "Profile" },
                  { id: "documents", label: "Document Review" },
                  { id: "written", label: "Written Documents" },
                  { id: "academic", label: "Academic Profile" },
                  { id: "matches", label: "Course Matches" },
                  { id: "wishlist", label: "Wishlist" },
                  { id: "applications", label: "Applications" },
                  { id: "scholarships", label: "Scholarships" },
                  { id: "mock-interview", label: "Mock Interview" },
                  { id: "cv-builder", label: "CV Builder" },
                  { id: "payments", label: "Payments" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as "profile" | "documents" | "written" | "academic" | "matches" | "wishlist" | "applications" | "scholarships" | "mock-interview" | "cv-builder" | "payments")}
                    className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? "border-amber-500 text-amber-600"
                        : "border-transparent text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setStaffEditMode((prev) => !prev)}
                  className={`mb-2 rounded-lg border px-3 py-1.5 text-xs font-medium ${
                    staffEditMode
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                      : "border-slate-300 bg-white/80 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {staffEditMode ? "Exit Edit Mode" : "Edit Mode"}
                </button>
              )}
            </div>
          </div>

          {(activeTab === "profile" || activeTab === "documents") && (
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-slate-900">
                {activeTab === "profile" ? "Profile" : "Document Review"}
              </h2>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowLogCallModal(true)}
                  className="portal-btn-ghost flex items-center gap-2 text-sm"
                >
                  <CallIcon className="w-4 h-4" />
                  Log Call
                </button>
                <button
                  type="button"
                  onClick={() => setShowFollowUpModal(true)}
                  className="portal-btn-ghost flex items-center gap-2 text-sm"
                >
                  <Clock className="w-4 h-4" />
                  Schedule Follow-Up
                </button>
                {activeTab === "profile" && canEdit && (
                  <button
                    onClick={() => {
                      if (!canMutateStudent) {
                        toast.info("Enable Edit Mode first.");
                        return;
                      }
                      setEditing(!editing);
                    }}
                    className={`flex items-center gap-2 text-sm ${canMutateStudent ? "text-blue-600 hover:underline" : "text-slate-400"}`}
                  >
                    <Edit2 className="w-4 h-4" />
                    {editing ? "Cancel" : "Edit"}
                  </button>
                )}
              </div>
            </div>
          )}

          {activeTab === "profile" && (
            <>
              {editing ? (
                <form onSubmit={handleSave} className="portal-shell-card space-y-6 p-6">
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">First name</label>
                      <input
                        type="text"
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Last name</label>
                      <input
                        type="text"
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                      <input
                        type="text"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Nationality</label>
                      <input
                        type="text"
                        value={formData.nationality}
                        onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                      <input
                        type="text"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Passport Number</label>
                      <input
                        type="text"
                        value={formData.passportNumber}
                        onChange={(e) => setFormData({ ...formData, passportNumber: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Passport Expiry</label>
                      <input
                        type="date"
                        value={formData.passportExpiry || ""}
                        onChange={(e) => setFormData({ ...formData, passportExpiry: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Date of Birth</label>
                      <input
                        type="date"
                        value={formData.dateOfBirth || ""}
                        onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    {canEdit && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Assigned Counsellor</label>
                          <select
                            value={formData.assignedCounsellorId}
                            onChange={(e) => setFormData({ ...formData, assignedCounsellorId: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg"
                          >
                            <option value="">Unassigned</option>
                            {counsellors.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Sub-Agent</label>
                          <select
                            value={formData.subAgentId}
                            onChange={(e) => setFormData({ ...formData, subAgentId: e.target.value, subAgentStaffId: "" })}
                            className="w-full px-3 py-2 border rounded-lg"
                          >
                            <option value="">None</option>
                            {subAgents.map((a) => (
                              <option key={a.id} value={a.id}>{a.agencyName}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Branch Counsellor</label>
                          <select
                            value={formData.subAgentStaffId}
                            onChange={(e) => setFormData({ ...formData, subAgentStaffId: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg"
                            disabled={!formData.subAgentId}
                          >
                            <option value="">Unassigned</option>
                            {subAgentTeam.filter((member) => member.isActive).map((member) => (
                              <option key={member.id} value={member.id}>{member.name || member.email}</option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-4">
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:opacity-90"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="portal-shell-card p-6">
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div><p className="text-xs text-slate-500 uppercase">First name</p><p className="text-sm">{student.firstName}</p></div>
                    <div><p className="text-xs text-slate-500 uppercase">Last name</p><p className="text-sm">{student.lastName}</p></div>
                    <div><p className="text-xs text-slate-500 uppercase">Email</p><p className="text-sm">{student.email}</p></div>
                    <div><p className="text-xs text-slate-500 uppercase">Phone</p><p className="text-sm">{student.phone || ""}</p></div>
                    <div><p className="text-xs text-slate-500 uppercase">Nationality</p><p className="text-sm">{student.nationality || ""}</p></div>
                    <div><p className="text-xs text-slate-500 uppercase">Address</p><p className="text-sm">{student.address || ""}</p></div>
                    <div><p className="text-xs text-slate-500 uppercase">Passport #</p><p className="text-sm">{student.passportNumber || ""}</p></div>
                    <div><p className="text-xs text-slate-500 uppercase">Passport expiry</p><p className="text-sm">{formatDate(student.passportExpiry)}</p></div>
                    <div><p className="text-xs text-slate-500 uppercase">DOB</p><p className="text-sm">{formatDate(student.dateOfBirth)}</p></div>
                    {student.assignedCounsellor && (
                      <div><p className="text-xs text-slate-500 uppercase">Counsellor</p><p className="text-sm">{student.assignedCounsellor.name}</p></div>
                    )}
                    {student.subAgent && (
                      <div><p className="text-xs text-slate-500 uppercase">Sub-Agent</p><p className="text-sm">{student.subAgent.agencyName}</p></div>
                    )}
                    {student.subAgentStaff && (
                      <div><p className="text-xs text-slate-500 uppercase">Branch Counsellor</p><p className="text-sm">{student.subAgentStaff.name || student.subAgentStaff.email}</p></div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === "documents" && (
            <div className="portal-shell-card p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-slate-900">Student Documents</h3>
                <div className="flex flex-wrap items-center gap-2">
                {docSummary?.allChecklistItemsVerified && !docSummary?.certificateAlreadyGenerated && (
                  <button
                    type="button"
                    onClick={() => {
                      void generateChecklistCertificate();
                    }}
                    className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                  >
                    Generate Certificate
                  </button>
                )}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!canMutateStudent) {
                        setActionError("Enable Edit Mode to request documents.");
                        return;
                      }
                      setShowRequestModal(true);
                      setActionError(null);
                      setActionMessage(null);
                    }}
                    disabled={!canMutateStudent}
                    className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Request Document
                  </button>
                )}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!canMutateStudent) {
                        setActionError("Enable Edit Mode to upload documents.");
                        return;
                      }
                      setShowUploadModal(true);
                      setActionError(null);
                      setActionMessage(null);
                    }}
                    disabled={!canMutateStudent}
                    className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    <Upload className="h-4 w-4" />
                    Upload Document
                  </button>
                )}
                </div>
              </div>

              {hasActiveMobileUpload && (
                <div className="mb-4 inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                  📱 Waiting for mobile upload...
                </div>
              )}
              {actionMessage && (
                <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                  {actionMessage}
                </div>
              )}
              {actionError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {actionError}
                </div>
              )}

              {documentsLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading documents...
                </div>
              ) : documents.length === 0 ? (
                <p className="text-sm text-slate-500">No documents uploaded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500 border-b">
                        <th className="py-2 pr-4">Document</th>
                        <th className="py-2 pr-4">Scan</th>
                        <th className="py-2 pr-4">Lock</th>
                        <th className="py-2 pr-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents.map((doc) => {
                        const isLocked = Boolean(doc.scanResult?.isLocked);
                        const isRescanEligible = isScanEligible(doc.type);
                        const badge = scanBadge(doc);
                        const canOpenModal =
                          canReviewScan &&
                          isRescanEligible &&
                          doc.scanResult?.status === "COMPLETED";

                        return (
                          <tr key={doc.id} className="border-b last:border-0">
                            <td className="py-3 pr-4 align-top">
                              <div className="font-medium text-slate-800">{doc.type.replaceAll("_", " ")}</div>
                              <a
                                href={toApiFilesPath(doc.fileUrl)}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-blue-600 hover:underline"
                              >
                                {doc.fileName}
                              </a>
                              {doc.type === "PASSPORT" && (
                                <div className="mt-1">
                                  {doc.scanResult?.counsellorDecision === "REVISION_REQUIRED" ? (
                                    <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Needs Revision</span>
                                  ) : doc.status === "VERIFIED" ? (
                                    <span className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Verified</span>
                                  ) : doc.status === "REJECTED" ? (
                                    <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Rejected</span>
                                  ) : (
                                    <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Pending</span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="py-3 pr-4 align-top">
                              <button
                                type="button"
                                disabled={!canOpenModal}
                                onClick={() => {
                                  if (!canOpenModal) return;
                                  setActiveScanDoc(doc);
                                  setDecisionAction(null);
                                  setDecisionNote(doc.scanResult?.counsellorNote || "");
                                  setActionError(null);
                                }}
                                className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium ${badge.className} ${canOpenModal ? "hover:opacity-90" : "cursor-default"}`}
                              >
                                {badge.spinning && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                {badge.label}
                              </button>
                              {doc.scanResult?.counsellorDecision && (
                                <div className="mt-1 text-xs text-slate-500">
                                  Decision: {doc.scanResult.counsellorDecision.replaceAll("_", " ")}
                                </div>
                              )}
                            </td>
                            <td className="py-3 pr-4 align-top">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${isLocked ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700"}`}>
                                {isLocked ? "Locked" : "Unlocked"}
                              </span>
                            </td>
                            <td className="py-3 pr-4 align-top">
                              <div className="flex flex-wrap gap-2">
                                {isRescanEligible && (
                                  <button
                                    type="button"
                                    disabled={isLocked || rescanLoadingId === doc.id}
                                    onClick={() => handleRescan(doc.id)}
                                    className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                  >
                                    {rescanLoadingId === doc.id ? "Rescanning..." : "Rescan"}
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => {
                                    setPreviewDoc({ fileName: doc.fileName, fileUrl: toApiFilesPath(doc.fileUrl) });
                                  }}
                                  className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
                                >
                                  Preview
                                </button>

                                <a
                                  href={toApiFilesDownloadPath(doc.fileUrl)}
                                  className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
                                >
                                  Download
                                </a>

                                <button
                                  type="button"
                                  onClick={() => {
                                    void deleteDocument(doc.id);
                                  }}
                                  disabled={!canMutateStudent}
                                  className="px-3 py-1.5 rounded border border-red-300 text-red-700 hover:bg-red-50"
                                >
                                  Delete
                                </button>

                                {userRole === "ADMIN" && isLocked && (
                                  <button
                                    type="button"
                                    disabled={unlockLoadingId === doc.id}
                                    onClick={() => {
                                      setUnlockTarget(doc);
                                      setUnlockReason("");
                                      setActionError(null);
                                    }}
                                    className="px-3 py-1.5 rounded border border-blue-300 text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                                  >
                                    Unlock for Re-scan
                                  </button>
                                )}
                                {doc.type === "PASSPORT" && canEdit && doc.status !== "VERIFIED" && (
                                  <button
                                    type="button"
                                    disabled={passportDecisionLoadingId === doc.id}
                                    onClick={() => void handlePassportDecision(doc.id, "ACCEPTED")}
                                    className="px-3 py-1.5 rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                                  >
                                    {passportDecisionLoadingId === doc.id ? "Saving..." : "Approve"}
                                  </button>
                                )}
                                {doc.type === "PASSPORT" && canEdit && doc.status !== "REJECTED" && doc.scanResult?.counsellorDecision !== "REVISION_REQUIRED" && (
                                  <button
                                    type="button"
                                    disabled={passportDecisionLoadingId === doc.id}
                                    onClick={() => void handlePassportDecision(doc.id, "REVISION_REQUIRED")}
                                    className="px-3 py-1.5 rounded border border-amber-300 text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                                  >
                                    Request Revision
                                  </button>
                                )}
                                {doc.type === "PASSPORT" && canEdit && doc.status !== "REJECTED" && (
                                  <button
                                    type="button"
                                    disabled={passportDecisionLoadingId === doc.id}
                                    onClick={() => void handlePassportDecision(doc.id, "REJECTED")}
                                    className="px-3 py-1.5 rounded border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
                                  >
                                    Reject
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="mt-6 border-t border-slate-200 pt-5">
                <h4 className="text-sm font-semibold text-slate-900">Document Requests</h4>
                <p className="mt-1 text-xs text-slate-500">Track staff-requested documents and review uploaded files.</p>

                {requestLoading ? (
                  <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading document requests...
                  </div>
                ) : documentRequests.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">No staff-requested items yet.</p>
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-slate-500">
                          <th className="py-2 pr-4">Document Name</th>
                          <th className="py-2 pr-4">Requested By</th>
                          <th className="py-2 pr-4">Date</th>
                          <th className="py-2 pr-4">Status</th>
                          <th className="py-2 pr-4">File</th>
                          <th className="py-2 pr-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {documentRequests.map((row) => {
                          const statusLabel = row.verificationStatus !== "PENDING" ? row.verificationStatus : row.status;
                          const canVerify = row.status === "UPLOADED" || row.uploadedFileUrl;
                          const isBusy = requestActionLoadingId === row.id;
                          return (
                            <tr key={row.id} className="border-b last:border-0">
                              <td className="py-2 pr-4 align-top">
                                <p className="font-medium text-slate-900">{row.customLabel || row.documentLabel}</p>
                                {row.notes && <p className="text-xs italic text-slate-500">{row.notes}</p>}
                                {row.revisionNote && <p className="text-xs text-amber-700">Revision: {row.revisionNote}</p>}
                              </td>
                              <td className="py-2 pr-4 align-top text-slate-700">{row.requestedByName} ({row.requestedByRole})</td>
                              <td className="py-2 pr-4 align-top text-slate-700">{new Date(row.createdAt).toLocaleDateString("en-GB")}</td>
                              <td className="py-2 pr-4 align-top">
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{statusLabel.replaceAll("_", " ")}</span>
                              </td>
                              <td className="py-2 pr-4 align-top">
                                {row.uploadedFileUrl ? (
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setPreviewDoc({ fileName: row.uploadedFileName || row.documentLabel, fileUrl: toApiFilesPath(row.uploadedFileUrl || "") })}
                                      className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                                    >
                                      Preview
                                    </button>
                                    <a
                                      href={toApiFilesDownloadPath(row.uploadedFileUrl)}
                                      className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                                    >
                                      Download
                                    </a>
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-500">Not uploaded</span>
                                )}
                              </td>
                              <td className="py-2 pr-4 align-top">
                                <div className="flex flex-wrap gap-2">
                                  {canVerify && statusLabel !== "VERIFIED" && (
                                    <>
                                      <button
                                        type="button"
                                        disabled={isBusy || !canMutateStudent}
                                        onClick={() => {
                                          void updateDocumentRequest(row.id, "VERIFY");
                                        }}
                                        className="rounded border border-emerald-300 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                                      >
                                        Verify
                                      </button>
                                      <button
                                        type="button"
                                        disabled={isBusy || !canMutateStudent}
                                        onClick={() => {
                                          void updateDocumentRequest(row.id, "REQUEST_REVISION");
                                        }}
                                        className="rounded border border-amber-300 px-2 py-1 text-xs text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                                      >
                                        Request Revision
                                      </button>
                                    </>
                                  )}
                                  {(userRole === "ADMIN" || userRole === "MANAGER") && (
                                    <button
                                      type="button"
                                      disabled={isBusy || !canMutateStudent}
                                      onClick={() => {
                                        void deleteDocumentRequest(row.id);
                                      }}
                                      className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                                    >
                                      Delete
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Signed Declarations Section */}
              <div className="mt-6 rounded-lg border border-slate-200 p-4">
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
      {showRequestModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Request Document</h3>
            <p className="mt-1 text-sm text-slate-500">Type any custom document name and optional note for the student.</p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Document Name</label>
                <input
                  value={requestDocumentName}
                  onChange={(event) => setRequestDocumentName(event.target.value)}
                  placeholder="e.g. Marriage Certificate"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Notes (optional)</label>
                <textarea
                  value={requestNotes}
                  onChange={(event) => setRequestNotes(event.target.value)}
                  placeholder="Describe exactly what is needed"
                  className="min-h-[110px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRequestModal(false)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void submitDocumentRequest();
                }}
                disabled={requestSubmitting}
                className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {requestSubmitting ? "Requesting..." : "Request"}
              </button>
            </div>
          </div>
        </div>
      )}

          {activeTab === "written" && (
            <div className="bg-white p-6 rounded-lg border border-slate-200">
              {actionMessage && (
                <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                  {actionMessage}
                </div>
              )}
              {actionError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {actionError}
                </div>
              )}

              {writtenLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading written documents...
                </div>
              ) : writtenDocuments.length === 0 ? (
                <p className="text-sm text-slate-500">No written documents found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500 border-b">
                        <th className="py-2 pr-4">Title</th>
                        <th className="py-2 pr-4">Type</th>
                        <th className="py-2 pr-4">Words</th>
                        <th className="py-2 pr-4">Grammar</th>
                        <th className="py-2 pr-4">Plagiarism</th>
                        <th className="py-2 pr-4">AI</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 pr-4">Date</th>
                        <th className="py-2 pr-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {writtenDocuments.map((doc) => (
                        <tr key={doc.id} className="border-b last:border-0">
                          <td className="py-3 pr-4 font-medium text-slate-800">{doc.title}</td>
                          <td className="py-3 pr-4">{doc.documentType === "SOP" ? "SOP" : "Personal Statement"}</td>
                          <td className="py-3 pr-4">{doc.wordCount}</td>
                          <td className="py-3 pr-4">
                            {doc.grammarScore != null ? (
                              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getGrammarScoreBadgeClass(doc.grammarScore)}`}>
                                {doc.grammarScore}%
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="py-3 pr-4">
                            {doc.plagiarismScore != null ? (
                              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getPlagiarismScoreBadgeClass(doc.plagiarismScore)}`}>
                                {getPlagiarismScoreLabel(doc.plagiarismScore)}
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="py-3 pr-4">
                            {(doc.aiContentScore ?? doc.aiScore) != null ? (
                              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getAiScoreBadgeClass(doc.aiContentScore ?? doc.aiScore ?? 0)}`}>
                                {getAiScoreLabel(doc.aiContentScore ?? doc.aiScore ?? 0)}
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="py-3 pr-4">{doc.status}</td>
                          <td className="py-3 pr-4">{new Date(doc.updatedAt).toLocaleDateString("en-GB")}</td>
                          <td className="py-3 pr-4">
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
          )}

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

          {activeTab === "academic" && (
            <div className="bg-white p-6 rounded-lg border border-slate-200">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Academic Profile</h3>
                  <p className="text-sm text-slate-600">
                    {reviewData?.academicProfileComplete ? "Profile complete" : "Profile incomplete"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {canEdit && <p className="text-xs text-slate-500">Grades can be edited when Edit Mode is enabled.</p>}
                  {canMutateStudent && (
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
                  )}
                </div>
              </div>

              {reviewError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{reviewError}</div>
              )}

              {reviewLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading academic profile...
                </div>
              ) : !reviewData || reviewData.qualifications.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-500">No qualifications available yet.</p>
                  {canMutateStudent && (
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
                  )}
                </div>
              ) : (
                <div className="space-y-5">
                  {reviewData.qualifications.map((qualification) => (
                    <div key={qualification.id} className="rounded-lg border border-slate-200 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{qualification.qualName}</p>
                          <p className="text-xs text-slate-600">
                            {qualification.institutionName || "-"} • {qualification.yearCompleted || "-"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-slate-600">Overall: {qualification.overallGrade || "-"}</p>
                          {canMutateStudent && (
                            <>
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
                            </>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="text-left text-slate-500 border-b">
                              <th className="py-2 pr-3">Subject</th>
                              <th className="py-2 pr-3">Grade Type</th>
                              <th className="py-2 pr-3">Grade</th>
                              <th className="py-2 pr-3">Universal</th>
                              <th className="py-2">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {qualification.subjects.length === 0 && (
                              <tr>
                                <td className="py-2 pr-3 text-slate-500" colSpan={5}>No subjects yet.</td>
                              </tr>
                            )}
                            {qualification.subjects.map((subject) => {
                              const isEditing = editingSubjectId === subject.id;
                              const draft = subjectDrafts[subject.id] || {
                                rawGrade: subject.rawGrade || "",
                                gradeType: subject.gradeType || inferGradeType(subject.rawGrade),
                              };

                              return (
                                <tr key={subject.id} className="border-b last:border-0">
                                  <td className="py-2 pr-3">
                                    {subject.subjectName}
                                  </td>
                                  <td className="py-2 pr-3">
                                    {isEditing ? (
                                      <select
                                        value={draft.gradeType}
                                        onChange={(e) =>
                                          setSubjectDrafts((prev) => ({
                                            ...prev,
                                            [subject.id]: { ...draft, gradeType: e.target.value as "GPA" | "LETTER", rawGrade: "" },
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
                                    {isEditing ? (
                                      draft.gradeType === "GPA" ? (
                                        <>
                                          <input
                                            type="number"
                                            min={0}
                                            max={5}
                                            step="0.01"
                                            list={`gpa-admin-${subject.id}`}
                                            value={draft.rawGrade}
                                            onChange={(e) =>
                                              setSubjectDrafts((prev) => ({
                                                ...prev,
                                                [subject.id]: { ...draft, rawGrade: e.target.value },
                                              }))
                                            }
                                            className="w-full rounded border border-slate-300 px-2 py-1"
                                          />
                                          <datalist id={`gpa-admin-${subject.id}`}>
                                            {GPA_OPTIONS.map((grade) => (
                                              <option key={grade} value={grade} />
                                            ))}
                                          </datalist>
                                        </>
                                      ) : (
                                        <select
                                          value={draft.rawGrade}
                                          onChange={(e) =>
                                            setSubjectDrafts((prev) => ({
                                              ...prev,
                                              [subject.id]: { ...draft, rawGrade: e.target.value },
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
                                  <td className="py-2">
                                    {!canEdit ? (
                                      <span className="text-xs text-slate-500">Read only</span>
                                    ) : !academicEditMode ? (
                                      <span className="text-xs text-slate-500">Enable Edit Mode</span>
                                    ) : isEditing ? (
                                      <div className="flex gap-2">
                                        <button
                                          type="button"
                                          disabled={savingSubjectId === subject.id}
                                          onClick={() => saveSubject(subject.id)}
                                          className="rounded bg-blue-600 px-3 py-1 text-xs text-white disabled:opacity-60"
                                        >
                                          {savingSubjectId === subject.id ? "Saving..." : "Save"}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setEditingSubjectId(null)}
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
                                            setEditingSubjectId(subject.id);
                                            setSubjectDrafts((prev) => ({
                                              ...prev,
                                              [subject.id]: {
                                                rawGrade: subject.rawGrade || "",
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

                      {canMutateStudent && (
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
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 border-t border-slate-200 pt-6">
                <TestScoresManager
                  studentId={student.id}
                  canManage={canEdit}
                  title="Test Scores"
                />
              </div>
            </div>
          )}

          {activeTab === "matches" && (
            <div className="bg-white p-6 rounded-lg border border-slate-200">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-slate-900">Course Matches</h3>
                <button
                  type="button"
                  disabled={pdfLoading}
                  onClick={() => downloadEligibilityReport()}
                  className="inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Generate Eligibility Report
                </button>
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
                          disabled={!canMutateStudent}
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
                          disabled={!canMutateStudent || savingNoteCourseId === match.courseId}
                          onClick={() => saveCounsellorNote(match.courseId)}
                          className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                        >
                          {savingNoteCourseId === match.courseId ? "Saving..." : "Save Note"}
                        </button>

                        <button
                          type="button"
                          onClick={() => downloadEligibilityReport(match.courseId)}
                          className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          PDF (This Course)
                        </button>

                        {match.matchStatus !== "FULL_MATCH" && !match.overridden && (
                          <button
                            type="button"
                            disabled={!canMutateStudent}
                            onClick={() => markCourseAsEligible(match.courseId)}
                            className="rounded border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                          >
                            Mark as Eligible
                          </button>
                        )}

                        {match.overridden && (userRole === "ADMIN" || userRole === "MANAGER") && (
                          <button
                            type="button"
                            onClick={() => removeEligibilityOverride(match.courseId)}
                            className="rounded border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50"
                          >
                            Remove Override
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => void addToWishlist(match.courseId)}
                          className="rounded border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50"
                        >
                          Save to Wishlist
                        </button>

                        {match.hasApplication && match.applicationId ? (
                          <Link
                            href={`/dashboard/applications/${match.applicationId}`}
                            className="rounded border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                          >
                            View Application
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setCreateAppModal({ courseId: match.courseId, courseName: match.course.name, universityId: match.course.university.id, universityName: match.course.university.name })}
                            className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Create Application
                          </button>
                        )}
                      </div>

                      {match.overridden && (
                        <p className="mt-3 text-xs text-emerald-700">
                          Manually approved by {match.overriddenByName || "Staff"}
                          {match.overriddenAt ? ` on ${new Date(match.overriddenAt).toLocaleDateString("en-GB")}` : ""}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "wishlist" && (
            <div className="bg-white p-6 rounded-lg border border-slate-200">
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

          {activeTab === "applications" && (
            <div className="bg-white p-6 rounded-lg border border-slate-200">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-slate-900">All Applications</h3>
              </div>
              {appsListError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{appsListError}</div>
              )}
              {appsListLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-600"><Loader2 className="w-4 h-4 animate-spin" /> Loading applications...</div>
              ) : studentApplicationsList.length === 0 ? (
                <p className="text-sm text-slate-500">No applications yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                        <th className="pb-2 pr-4 font-medium">University</th>
                        <th className="pb-2 pr-4 font-medium">Course</th>
                        <th className="pb-2 pr-4 font-medium">Status</th>
                        <th className="pb-2 pr-4 font-medium">Created</th>
                        <th className="pb-2 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {studentApplicationsList.map((app) => (
                        <tr key={app.id}>
                          <td className="py-2 pr-4">{app.university?.name || "-"}</td>
                          <td className="py-2 pr-4">{app.course?.name || "-"}</td>
                          <td className="py-2 pr-4">
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                              {app.status.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="py-2 pr-4 text-slate-500">{new Date(app.createdAt).toLocaleDateString("en-GB")}</td>
                          <td className="py-2">
                            <Link href={`/dashboard/applications/${app.id}`} className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">View</Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === "scholarships" && (
            <div className="space-y-5 rounded-lg border border-slate-200 bg-white p-6">
              {scholarshipError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{scholarshipError}</div>
              )}

              <div className="rounded-lg border border-slate-200 p-4">
                <h3 className="text-base font-semibold text-slate-900 mb-3">Add Scholarship Tracker Item</h3>
                <div className="grid gap-3 md:grid-cols-3">
                  <select
                    value={selectedScholarshipId}
                    disabled={!canMutateStudent}
                    onChange={(e) => setSelectedScholarshipId(e.target.value)}
                    className="rounded border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">Select scholarship</option>
                    {availableScholarships.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} • {item.university.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={newScholarshipStatus}
                    disabled={!canMutateStudent}
                    onChange={(e) => setNewScholarshipStatus(e.target.value as "INTERESTED" | "APPLIED" | "SHORTLISTED" | "AWARDED" | "REJECTED")}
                    className="rounded border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="INTERESTED">INTERESTED</option>
                    <option value="APPLIED">APPLIED</option>
                    <option value="SHORTLISTED">SHORTLISTED</option>
                    <option value="AWARDED">AWARDED</option>
                    <option value="REJECTED">REJECTED</option>
                  </select>
                  <button
                    onClick={() => addScholarshipTrackerItem()}
                    disabled={!canMutateStudent || savingScholarship === "new"}
                    className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {savingScholarship === "new" ? "Adding..." : "Add Item"}
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={newScholarshipNotes}
                  disabled={!canMutateStudent}
                  onChange={(e) => setNewScholarshipNotes(e.target.value)}
                  placeholder="Optional note"
                  className="mt-3 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              {scholarshipLoading ? (
                <div className="text-sm text-slate-600">Loading scholarships...</div>
              ) : scholarshipRows.length === 0 ? (
                <div className="text-sm text-slate-500">No scholarship tracker items yet.</div>
              ) : (
                <div className="space-y-4">
                  {scholarshipRows.map((row) => {
                    const draft = scholarshipDrafts[row.id];
                    if (!draft) return null;

                    return (
                      <div key={row.id} className="rounded-lg border border-slate-200 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900">{row.scholarship.name}</p>
                            <p className="text-xs text-slate-600">
                              {row.scholarship.university.name}
                              {row.scholarship.course?.name ? ` • ${row.scholarship.course.name}` : ""}
                            </p>
                          </div>
                          <p className="text-xs text-slate-600">
                            {row.scholarship.amountType === "PERCENTAGE"
                              ? `${row.scholarship.amount}% (${row.scholarship.percentageOf || "TOTAL"})`
                              : `${row.scholarship.currency} ${row.scholarship.amount.toLocaleString()}`}
                          </p>
                        </div>

                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <select
                            value={draft.status}
                            disabled={!canMutateStudent}
                            onChange={(e) =>
                              setScholarshipDrafts((prev) => ({
                                ...prev,
                                [row.id]: {
                                  ...prev[row.id],
                                  status: e.target.value as "INTERESTED" | "APPLIED" | "SHORTLISTED" | "AWARDED" | "REJECTED",
                                },
                              }))
                            }
                            className="rounded border border-slate-300 px-3 py-2 text-sm"
                          >
                            <option value="INTERESTED">INTERESTED</option>
                            <option value="APPLIED">APPLIED</option>
                            <option value="SHORTLISTED">SHORTLISTED</option>
                            <option value="AWARDED">AWARDED</option>
                            <option value="REJECTED">REJECTED</option>
                          </select>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Awarded amount"
                            value={draft.awardedAmount}
                            disabled={!canMutateStudent}
                            onChange={(e) =>
                              setScholarshipDrafts((prev) => ({
                                ...prev,
                                [row.id]: { ...prev[row.id], awardedAmount: e.target.value },
                              }))
                            }
                            className="rounded border border-slate-300 px-3 py-2 text-sm"
                          />
                          <textarea
                            rows={2}
                            placeholder="Counsellor note"
                            value={draft.counsellorNote}
                            disabled={!canMutateStudent}
                            onChange={(e) =>
                              setScholarshipDrafts((prev) => ({
                                ...prev,
                                [row.id]: { ...prev[row.id], counsellorNote: e.target.value },
                              }))
                            }
                            className="rounded border border-slate-300 px-3 py-2 text-sm"
                          />
                          <input
                            placeholder="Award letter URL"
                            value={draft.awardLetterUrl}
                            disabled={!canMutateStudent}
                            onChange={(e) =>
                              setScholarshipDrafts((prev) => ({
                                ...prev,
                                [row.id]: { ...prev[row.id], awardLetterUrl: e.target.value },
                              }))
                            }
                            className="rounded border border-slate-300 px-3 py-2 text-sm"
                          />
                        </div>

                        <div className="mt-3 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateScholarshipItem(row.id)}
                            disabled={!canMutateStudent || savingScholarship === row.id}
                            className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                          >
                            {savingScholarship === row.id ? "Saving..." : "Save Update"}
                          </button>
                          {row.appliedAt && <span className="text-xs text-slate-500">Applied: {new Date(row.appliedAt).toLocaleDateString("en-GB")}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === "cv-builder" && (
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <h3 className="text-lg font-semibold text-slate-900">CV Builder</h3>
              <p className="mt-1 text-sm text-slate-600">
                Review and edit this student&apos;s CV, regenerate profile summary, and download the latest PDF.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/dashboard/cv-builder?studentId=${student.id}`}
                  className="inline-flex items-center rounded-md bg-[#1B2A4A] px-3 py-2 text-sm font-semibold text-white"
                >
                  Open CV Builder
                </Link>
                <Link
                  href={`/dashboard/cv-builder?studentId=${student.id}`}
                  className="inline-flex items-center rounded-md bg-[#F5A623] px-3 py-2 text-sm font-semibold text-white"
                >
                  Download CV
                </Link>
              </div>
            </div>
          )}

          {activeTab === "mock-interview" && (
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <MockInterviewTab
                listEndpoint={`/api/counsellor/students/${student.id}/mock-interviews`}
                canAssign={false}
                scope="dashboard"
              />
            </div>
          )}

          {activeTab === "payments" && (
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <StudentPaymentsTab
                studentId={student.id}
                currentUserRole={userRole}
              />
            </div>
          )}
        </div>
      </div>

      {unlockTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5">
            <h4 className="text-base font-semibold text-slate-900 mb-2">Unlock for Re-scan</h4>
            <p className="text-sm text-slate-600 mb-3">
              Enter the reason for unlocking this scan.
            </p>
            <textarea
              value={unlockReason}
              onChange={(e) => setUnlockReason(e.target.value)}
              rows={4}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Reason is required"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setUnlockTarget(null);
                  setUnlockReason("");
                }}
                className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={unlockLoadingId === unlockTarget.id}
                onClick={submitUnlock}
                className="px-3 py-1.5 rounded bg-blue-600 text-white hover:opacity-90 disabled:opacity-50"
              >
                {unlockLoadingId === unlockTarget.id ? "Unlocking..." : "Confirm Unlock"}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeScanDoc && activeScanDoc.scanResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h4 className="text-lg font-semibold text-slate-900">{activeScanDoc.fileName}</h4>
                <p className="text-sm text-slate-600">{activeScanDoc.type.replaceAll("_", " ")}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveScanDoc(null);
                  setDecisionAction(null);
                  setDecisionNote("");
                }}
                className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-slate-700 font-medium">Plagiarism Score</span>
                  <span className="text-slate-800">{activeScanDoc.scanResult.plagiarismScore ?? 0}%</span>
                </div>
                <div className="h-2 rounded bg-slate-100 overflow-hidden">
                  <div
                    className={`h-2 ${scoreTone(activeScanDoc.scanResult.plagiarismScore, scanSettings.plagiarismGreenMax, scanSettings.plagiarismAmberMax)}`}
                    style={{ width: `${Math.min(100, Math.max(0, activeScanDoc.scanResult.plagiarismScore ?? 0))}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-slate-700 font-medium">AI Content Score</span>
                  <span className="text-slate-800">{activeScanDoc.scanResult.aiScore ?? 0}%</span>
                </div>
                <div className="h-2 rounded bg-slate-100 overflow-hidden">
                  <div
                    className={`h-2 ${scoreTone(activeScanDoc.scanResult.aiScore, scanSettings.aiGreenMax, scanSettings.aiAmberMax)}`}
                    style={{ width: `${Math.min(100, Math.max(0, activeScanDoc.scanResult.aiScore ?? 0))}%` }}
                  />
                </div>
              </div>

              <div>
                <span className={`inline-flex px-4 py-2 rounded-full text-sm font-semibold ${activeScanDoc.scanResult.flagColour === "GREEN" ? "bg-emerald-100 text-emerald-700" : activeScanDoc.scanResult.flagColour === "AMBER" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                  Overall Flag: {activeScanDoc.scanResult.flagColour || "N/A"}
                </span>
              </div>

              {activeScanDoc.scanResult.reportUrl && (
                <a
                  href={activeScanDoc.scanResult.reportUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  View Full Report
                </a>
              )}

              {canReviewScan && (
                <div className="pt-2 border-t border-slate-200 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={decisionLoading}
                      onClick={() => submitDecision("ACCEPTED")}
                      className="px-3 py-1.5 rounded bg-emerald-600 text-white hover:opacity-90 disabled:opacity-50"
                    >
                      Accept Document
                    </button>
                    <button
                      type="button"
                      disabled={decisionLoading}
                      onClick={() => setDecisionAction("REVISION_REQUIRED")}
                      className="px-3 py-1.5 rounded bg-amber-500 text-white hover:opacity-90 disabled:opacity-50"
                    >
                      Request Revision
                    </button>
                    <button
                      type="button"
                      disabled={decisionLoading}
                      onClick={() => setDecisionAction("REJECTED")}
                      className="px-3 py-1.5 rounded bg-red-600 text-white hover:opacity-90 disabled:opacity-50"
                    >
                      Reject Document
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(activeScanDoc.scanResult.isLocked) || rescanLoadingId === activeScanDoc.id}
                      onClick={() => handleRescan(activeScanDoc.id)}
                      className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {rescanLoadingId === activeScanDoc.id ? "Rescanning..." : "Rescan"}
                    </button>
                  </div>

                  {(decisionAction === "REVISION_REQUIRED" || decisionAction === "REJECTED") && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">
                        {decisionAction === "REJECTED" ? "Rejection Reason" : "Revision Note"}
                      </label>
                      <textarea
                        rows={4}
                        value={decisionNote}
                        onChange={(e) => setDecisionNote(e.target.value)}
                        className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        disabled={decisionLoading}
                        onClick={() => submitDecision(decisionAction)}
                        className="px-3 py-1.5 rounded bg-blue-600 text-white hover:opacity-90 disabled:opacity-50"
                      >
                        {decisionLoading ? "Saving..." : "Submit Decision"}
                      </button>
                    </div>
                  )}
                </div>
              )}
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

      {showUploadModal && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Upload Document</h3>
            <p className="mt-1 text-sm text-slate-500">Upload a document on behalf of this student.</p>

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Document Type</label>
                <select
                  value={uploadType}
                  onChange={(e) => setUploadType(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  {ADMIN_UPLOAD_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">File</label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.docx"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <p className="mt-1 text-xs text-slate-500">Accepted: PDF, JPG, PNG, DOCX</p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Notes (optional)</label>
                <textarea
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Add any context for this upload"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (uploadingDocument) return;
                  setShowUploadModal(false);
                }}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={uploadingDocument}
                onClick={() => {
                  void uploadDocumentAsAdmin();
                }}
                className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {uploadingDocument ? "Uploading..." : "Upload"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log Call Modal */}
      <LogCallModal
        studentId={student.id}
        studentName={`${student.firstName} ${student.lastName}`}
        isOpen={showLogCallModal}
        onClose={() => setShowLogCallModal(false)}
        entityType="student"
      />

      <FollowUpModal
        entityType="student"
        entityId={student.id}
        entityName={`${student.firstName} ${student.lastName}`}
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
                    <p className="text-sm text-slate-800">{student.firstName} {student.lastName}</p>
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
                  href={`/dashboard/applications/${createAppCreated.id}`}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  View Application
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
