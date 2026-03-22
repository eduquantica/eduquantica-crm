"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { QualType } from "@prisma/client";
import { toast } from "sonner";
import DocumentPreviewModal from "@/components/shared/DocumentPreviewModal";
import QRCodeUploadModal from "@/components/shared/QRCodeUploadModal";
import { toApiFilesDownloadPath } from "@/lib/file-url";

type SubjectRow = {
  id: string;
  subjectName: string;
  rawGrade: string;
  gradeType: "GPA" | "LETTER";
  confidence: number;
};

type Qualification = {
  id: string;
  qualType: string;
  qualName: string;
  institutionName: string | null;
  yearCompleted: number | null;
  overallGrade: string | null;
  status: "PROCESSING" | "COMPLETED" | "FAILED";
  ocrConfirmedByStudent: boolean;
  transcriptUrl: string;
  transcriptFileName: string;
  transcriptDocumentId: string;
  transcriptUploadedAt: string;
  certificateUrl: string;
  certificateFileName: string;
  certificateDocumentId: string;
  certificateUploadedAt: string;
  subjects: Array<{
    id: string;
    subjectName: string;
    rawGrade: string | null;
    gradeType: "GPA" | "LETTER";
    ocrConfidence: number | null;
  }>;
};

const GPA_OPTIONS = ["1.0", "1.5", "2.0", "2.5", "3.0", "3.5", "4.0", "4.25", "4.5", "4.75", "5.0"];
const LETTER_OPTIONS = ["A*", "A", "A-", "B+", "B", "B-", "C+", "C", "C-"];

function inferGradeType(value: string): "GPA" | "LETTER" {
  const num = Number(value.trim());
  if (!Number.isNaN(num) && num >= 0 && num <= 5) {
    return "GPA";
  }
  return "LETTER";
}

function formatTypedGrade(rawGrade: string | null, gradeType: "GPA" | "LETTER"): string {
  if (!rawGrade) return "-";
  if (gradeType === "GPA") return `${rawGrade} / 5.0 GPA`;
  return rawGrade;
}

type AcademicResponse = {
  data: {
    studentId: string;
    isComplete: boolean;
    qualifications: Qualification[];
  };
};

const QUAL_OPTIONS = [
  {
    label: "Secondary",
    items: ["SSC", "O-Level", "GCSE", "IGCSE", "Grade 10/Year 10", "Dakhil", "Other Secondary"],
  },
  {
    label: "Higher Secondary",
    items: ["HSC", "A-Level", "IAL", "Grade 12/Year 12", "Alim", "IB", "BTEC Level 3", "Foundation", "Other Higher Secondary"],
  },
  {
    label: "Undergraduate",
    items: ["BA", "BSc", "BBA", "BEng", "LLB", "MBBS", "HND", "Associate Degree", "Other Undergraduate"],
  },
  {
    label: "Postgraduate",
    items: ["MA", "MSc", "MBA", "MEng", "LLM", "MPhil", "PG Diploma", "PG Certificate", "Other Postgraduate"],
  },
  {
    label: "Doctoral",
    items: ["PhD", "DBA", "Other Doctoral"],
  },
  {
    label: "Professional",
    items: ["BTEC Level 2/4/5", "ACCA", "CPA", "CFA", "Diploma", "Certificate", "NVQ", "Other Professional"],
  },
];

function mapSelectionToQualType(label: string): QualType {
  const normalized = label.toLowerCase();
  if (normalized.includes("a-level") || normalized === "ial") return "A_LEVEL";
  if (normalized.includes("o-level") || normalized.includes("igcse") || normalized.includes("year 10") || normalized.includes("grade 10")) return "O_LEVEL";
  if (normalized === "gcse") return "GCSE";
  if (normalized === "ssc") return "SSC";
  if (normalized === "hsc") return "HSC";
  if (normalized === "ib") return "IB";
  if (normalized.includes("foundation")) return "FOUNDATION";
  return "OTHER";
}

function isYear10Or12(label: string): boolean {
  const normalized = label.toLowerCase();
  return normalized.includes("year 10") || normalized.includes("grade 10") || normalized.includes("year 12") || normalized.includes("grade 12");
}

function isBachelorOrMaster(label: string): boolean {
  const normalized = label.toLowerCase();
  return ["ba", "bsc", "bba", "beng", "llb", "mbbs", "ma", "msc", "mba", "meng", "llm", "mphil"].includes(normalized);
}

function confidenceColor(value: number): string {
  if (value >= 0.8) return "bg-emerald-500";
  if (value >= 0.5) return "bg-amber-500";
  return "bg-rose-500";
}

function statusBadge(qualification: Qualification): { label: string; cls: string } {
  if (qualification.status === "PROCESSING") {
    return { label: "OCR Processing", cls: "bg-blue-100 text-blue-700" };
  }
  if (qualification.status === "FAILED") {
    return { label: "OCR Failed", cls: "bg-rose-100 text-rose-700" };
  }
  if (qualification.ocrConfirmedByStudent) {
    return { label: "OCR Confirmed", cls: "bg-emerald-100 text-emerald-700" };
  }
  return { label: "Awaiting Confirmation", cls: "bg-amber-100 text-amber-700" };
}

function newRow(subjectName = "", rawGrade = "", confidence = 0.5, gradeType: "GPA" | "LETTER" = "LETTER"): SubjectRow {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    subjectName,
    rawGrade,
    gradeType,
    confidence,
  };
}

function splitInstitutionAndCountry(value: string | null): { institutionName: string; countryOfStudy: string } {
  if (!value) {
    return { institutionName: "", countryOfStudy: "" };
  }

  const parts = value.split(" | ");
  if (parts.length < 2) {
    return { institutionName: value, countryOfStudy: "" };
  }

  return {
    institutionName: parts[0] || "",
    countryOfStudy: parts.slice(1).join(" | "),
  };
}

function isKnownQualification(label: string): boolean {
  return QUAL_OPTIONS.some((group) => group.items.includes(label));
}

export default function StudentAcademicProfilePage() {
  const [studentId, setStudentId] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [openForm, setOpenForm] = useState(false);
  const [step, setStep] = useState(1);
  const [qualSelection, setQualSelection] = useState("");
  const [otherQualText, setOtherQualText] = useState("");
  const [institutionName, setInstitutionName] = useState("");
  const [countryOfStudy, setCountryOfStudy] = useState("");
  const [yearCompleted, setYearCompleted] = useState<number | "">("");
  const [overallGrade, setOverallGrade] = useState("");
  const [manualRows, setManualRows] = useState<Array<{ subjectName: string; rawGrade: string }>>([{ subjectName: "", rawGrade: "" }]);
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrDocumentField, setQrDocumentField] = useState<"TRANSCRIPT" | "CERTIFICATE">("TRANSCRIPT");
  const [qualificationId, setQualificationId] = useState("");
  const [ocrRows, setOcrRows] = useState<SubjectRow[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [qualificationGradeType, setQualificationGradeType] = useState<"GPA" | "LETTER">("LETTER");
  const [editingQualificationId, setEditingQualificationId] = useState<string | null>(null);
  const [activeInputKey, setActiveInputKey] = useState<string | null>(null);
  const [activeInputCaret, setActiveInputCaret] = useState<number | null>(null);
  const [previewDocument, setPreviewDocument] = useState<{ fileUrl: string; fileName: string } | null>(null);

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const isEditing = !!editingQualificationId;

  useEffect(() => {
    if (!activeInputKey) return;
    const input = inputRefs.current[activeInputKey];
    if (!input) return;

    input.focus();
    if (activeInputCaret !== null) {
      input.setSelectionRange(activeInputCaret, activeInputCaret);
    }
  }, [ocrRows, activeInputKey, activeInputCaret]);

  async function loadProfile() {
    try {
      setLoading(true);
      const res = await fetch("/api/student/academic-profile", { cache: "no-store" });
      const json = (await res.json()) as AcademicResponse | { error: string };
      if (!res.ok || !("data" in json)) {
        throw new Error("error" in json ? json.error : "Failed to load profile");
      }

      setStudentId(json.data.studentId);
      setIsComplete(json.data.isComplete);
      setQualifications(json.data.qualifications);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProfile();
  }, []);

  const selectedLabel = useMemo(() => {
    if (qualSelection === "Other (free text)") return otherQualText.trim();
    return qualSelection;
  }, [qualSelection, otherQualText]);

  function resetForm() {
    setStep(1);
    setQualSelection("");
    setOtherQualText("");
    setInstitutionName("");
    setCountryOfStudy("");
    setYearCompleted("");
    setOverallGrade("");
    setManualRows([{ subjectName: "", rawGrade: "" }]);
    setTranscriptFile(null);
    setCertificateFile(null);
    setUploading(false);
    setQualificationId("");
    setOcrRows([]);
    setConfirming(false);
    setQualificationGradeType("LETTER");
    setEditingQualificationId(null);
    setActiveInputKey(null);
    setActiveInputCaret(null);
    setMessage(null);
  }

  async function handleDeleteQualification(id: string) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this qualification? This cannot be undone.",
    );

    if (!confirmed) return;

    try {
      const res = await fetch(`/api/qualifications/${id}`, { method: "DELETE" });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error || "Failed to delete qualification");
      }

      setQualifications((prev) => prev.filter((qualification) => qualification.id !== id));
      toast.success("Qualification deleted");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete qualification");
    }
  }

  function handleEditQualification(qualification: Qualification) {
    resetForm();
    setOpenForm(true);
    setEditingQualificationId(qualification.id);
    setQualificationId(qualification.id);

    if (isKnownQualification(qualification.qualName)) {
      setQualSelection(qualification.qualName);
      setOtherQualText("");
    } else {
      setQualSelection("Other (free text)");
      setOtherQualText(qualification.qualName);
    }

    const split = splitInstitutionAndCountry(qualification.institutionName);
    setInstitutionName(split.institutionName);
    setCountryOfStudy(split.countryOfStudy);
    setYearCompleted(qualification.yearCompleted ?? "");
    setOverallGrade(qualification.overallGrade || "");

    const rows = qualification.subjects.map((subject) =>
      newRow(subject.subjectName, subject.rawGrade || "", subject.ocrConfidence ?? 0.5, subject.gradeType || inferGradeType(subject.rawGrade || "")),
    );

    if (rows.length > 0) {
      setQualificationGradeType(rows[0].gradeType);
    }

    setManualRows(
      rows.length > 0
        ? rows.map((row) => ({ subjectName: row.subjectName, rawGrade: row.rawGrade }))
        : [{ subjectName: "", rawGrade: "" }],
    );
    setOcrRows(rows.length > 0 ? rows : [newRow()]);
    setStep(1);
  }

  async function upsertQualificationWithoutOcr(uploadedUrl: string, uploadedName: string): Promise<string> {
    let uploadedCertificateUrl = "";
    let uploadedCertificateName = "";

    if (certificateFile) {
      const certificateFd = new FormData();
      certificateFd.append("files", certificateFile);
      const certificateUploadRes = await fetch("/api/upload", { method: "POST", body: certificateFd });
      const certificateUploadJson = (await certificateUploadRes.json()) as { urls?: string[]; error?: string };
      if (!certificateUploadRes.ok || !certificateUploadJson.urls?.[0]) {
        throw new Error(certificateUploadJson.error || "Certificate upload failed");
      }
      uploadedCertificateUrl = certificateUploadJson.urls[0];
      uploadedCertificateName = certificateFile.name;
    }

    const payload = {
      qualType: mapSelectionToQualType(selectedLabel),
      qualName: selectedLabel,
      institutionName,
      countryOfStudy,
      yearCompleted: yearCompleted === "" ? undefined : Number(yearCompleted),
      overallGrade: overallGrade || undefined,
      fileUrl: uploadedUrl,
      fileName: uploadedName,
      certificateFileUrl: uploadedCertificateUrl || undefined,
      certificateFileName: uploadedCertificateName || undefined,
      ocrStatus: "SKIPPED",
    };

    if (isEditing && qualificationId) {
      const patchRes = await fetch(`/api/qualifications/${qualificationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const patchJson = (await patchRes.json()) as { data?: { id?: string }; error?: string };
      if (!patchRes.ok || !patchJson.data?.id) {
        throw new Error(patchJson.error || "Failed to save qualification");
      }

      return patchJson.data.id;
    }

    const createRes = await fetch("/api/student/academic-profile/qualifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const createJson = (await createRes.json()) as { data?: { id?: string }; error?: string };
    if (!createRes.ok || !createJson.data?.id) {
      throw new Error(createJson.error || "Failed to create qualification");
    }

    return createJson.data.id;
  }

  async function handleSaveWithoutOcr() {
    if (!studentId || !transcriptFile || !selectedLabel) return;

    try {
      setUploading(true);

      let uploadedUrl = "";
      let uploadedName = transcriptFile.name;

      try {
        const fd = new FormData();
        fd.append("files", transcriptFile);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
        const uploadJson = (await uploadRes.json()) as { urls?: string[]; error?: string };
        if (!uploadRes.ok || !uploadJson.urls?.[0]) {
          throw new Error(uploadJson.error || "Upload failed");
        }
        uploadedUrl = uploadJson.urls[0];
      } catch {
        // Keep the form flow usable even when upload processing is unavailable.
        uploadedUrl = `manual-entry://${Date.now()}-${encodeURIComponent(transcriptFile.name)}`;
        uploadedName = transcriptFile.name || "manual-entry";
      }

      const savedQualificationId = await upsertQualificationWithoutOcr(uploadedUrl, uploadedName);
      setQualificationId(savedQualificationId);

      const seedManualRows = manualRows
        .filter((row) => row.subjectName.trim() || row.rawGrade.trim())
        .map((row) => newRow(row.subjectName.trim(), row.rawGrade.trim(), 0.5, qualificationGradeType));

      setOcrRows(seedManualRows.length > 0 ? seedManualRows : [newRow()]);
      setStep(4);
      setMessage("Transcript saved without OCR. You can now enter subject grades manually.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save without OCR");
    } finally {
      setUploading(false);
    }
  }

  async function handleUploadAndScan() {
    if (!studentId || !transcriptFile || !selectedLabel) return;
    try {
      setUploading(true);

      const fd = new FormData();
      fd.append("files", transcriptFile);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
      const uploadJson = await uploadRes.json() as { urls?: string[]; error?: string; message?: string };
      if (!uploadRes.ok || !uploadJson.urls?.[0]) {
        throw new Error(uploadJson.error || "Upload failed");
      }

      const scanRes = await fetch(`/api/students/${studentId}/transcripts/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileUrl: uploadJson.urls[0],
          qualType: mapSelectionToQualType(selectedLabel),
          qualName: selectedLabel,
          institutionName,
          countryOfStudy,
          yearCompleted: yearCompleted === "" ? undefined : Number(yearCompleted),
          overallGrade: overallGrade || undefined,
        }),
      });

      const scanJson = await scanRes.json() as {
        data?: {
          qualificationId: string;
          status: "PROCESSING" | "COMPLETED";
          demoMode?: boolean;
          message?: string;
        };
        error?: string;
      };
      if (!scanRes.ok || !scanJson.data?.qualificationId) {
        throw new Error(scanJson.error || "Failed to run OCR scan");
      }

      const newQualificationId = scanJson.data.qualificationId;
      setQualificationId(newQualificationId);

      if (certificateFile) {
        const certificateFd = new FormData();
        certificateFd.append("files", certificateFile);
        const certificateUploadRes = await fetch("/api/upload", { method: "POST", body: certificateFd });
        const certificateUploadJson = (await certificateUploadRes.json()) as { urls?: string[]; error?: string };
        if (!certificateUploadRes.ok || !certificateUploadJson.urls?.[0]) {
          throw new Error(certificateUploadJson.error || "Certificate upload failed");
        }

        const certificatePatchRes = await fetch(`/api/qualifications/${newQualificationId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            certificateFileUrl: certificateUploadJson.urls[0],
            certificateFileName: certificateFile.name,
          }),
        });
        const certificatePatchJson = (await certificatePatchRes.json()) as { error?: string };
        if (!certificatePatchRes.ok) {
          throw new Error(certificatePatchJson.error || "Failed to save certificate");
        }
      }

      const seedManualRows = manualRows
        .filter((row) => row.subjectName.trim() || row.rawGrade.trim())
        .map((row) => newRow(row.subjectName.trim(), row.rawGrade.trim(), 0.5, qualificationGradeType));

      if (scanJson.data.demoMode) {
        setMessage(
          scanJson.data.message ||
            "OCR scanning is not available in demo mode. Please enter your subject grades manually below.",
        );

        setOcrRows(seedManualRows.length > 0 ? seedManualRows : [newRow()]);
        setStep(4);
        await loadProfile();
        return;
      }

      let latestRows: SubjectRow[] = [];
      for (let index = 0; index < 40; index += 1) {
        const detailRes = await fetch(`/api/student/academic-profile/qualifications/${newQualificationId}`, { cache: "no-store" });
        if (!detailRes.ok) break;
        const detailJson = await detailRes.json() as { data: Qualification };

        latestRows = (detailJson.data.subjects || []).map((subject) =>
          newRow(
            subject.subjectName,
            subject.rawGrade || "",
            subject.ocrConfidence ?? 0.5,
            subject.gradeType || inferGradeType(subject.rawGrade || ""),
          ),
        );

        if (latestRows.length > 0) {
          setQualificationGradeType(latestRows[0].gradeType);
        }

        if (detailJson.data.status !== "PROCESSING") {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      setOcrRows([...latestRows, ...seedManualRows]);
      setStep(4);
      await loadProfile();
      if (uploadJson.message) {
        setMessage(uploadJson.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload and scan transcript");
    } finally {
      setUploading(false);
    }
  }

  async function saveAndNext() {
    if (!qualificationId || ocrRows.length === 0 || !selectedLabel) return;

    const cleanedRows = ocrRows
      .map((row) => ({
        subjectName: row.subjectName.trim(),
        rawGrade: row.rawGrade.trim(),
        gradeType: row.gradeType,
        confidence: row.confidence,
      }))
      .filter((row) => row.subjectName);

    if (cleanedRows.length === 0) {
      setError("Please add at least one subject before saving.");
      return;
    }

    try {
      setConfirming(true);
      const res = await fetch(`/api/qualifications/${qualificationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qualType: mapSelectionToQualType(selectedLabel),
          qualName: selectedLabel,
          institutionName,
          countryOfStudy,
          yearCompleted: yearCompleted === "" ? undefined : Number(yearCompleted),
          overallGrade: overallGrade || undefined,
          subjects: cleanedRows,
        }),
      });
      const json = (await res.json()) as { data?: Qualification; error?: string };
      if (!res.ok || !json.data) {
        throw new Error(json.error || "Failed to save qualification");
      }

      setQualifications((prev) => {
        const index = prev.findIndex((qualification) => qualification.id === json.data!.id);
        if (index === -1) {
          return [json.data!, ...prev];
        }
        const next = [...prev];
        next[index] = json.data!;
        return next;
      });

      toast.success(isEditing ? "Qualification updated" : "Qualification saved");
      setOpenForm(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save qualification");
    } finally {
      setConfirming(false);
    }
  }

  async function handleDeleteDocument(documentId: string, kind: "transcript" | "certificate") {
    try {
      const res = await fetch(`/api/documents/${documentId}`, { method: "DELETE" });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error || "Failed to delete document");
      }

      setQualifications((prev) => prev.map((qualification) => {
        if (kind === "transcript" && qualification.transcriptDocumentId === documentId) {
          return {
            ...qualification,
            transcriptUrl: "",
            transcriptFileName: "",
            transcriptDocumentId: "",
            transcriptUploadedAt: "",
          };
        }

        if (kind === "certificate" && qualification.certificateDocumentId === documentId) {
          return {
            ...qualification,
            certificateUrl: "",
            certificateFileName: "",
            certificateDocumentId: "",
            certificateUploadedAt: "",
          };
        }

        return qualification;
      }));

      toast.success(kind === "transcript" ? "Transcript deleted" : "Certificate deleted");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete document");
    }
  }

  return (
    <main className="student-dashboard-bg mx-auto w-full max-w-6xl space-y-6 rounded-3xl px-4 py-6 sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Academic Profile</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Manage qualifications and confirm transcript OCR details.</p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <a href="#qualifications" className="font-medium text-blue-700 hover:text-blue-800 hover:underline dark:text-blue-300 dark:hover:text-blue-200">
              Qualifications
            </a>
            <span className="text-slate-300 dark:text-slate-500">•</span>
            <Link href="/student/courses" className="font-medium text-blue-700 hover:text-blue-800 hover:underline dark:text-blue-300 dark:hover:text-blue-200">
              Course Search
            </Link>
          </div>
        </div>
        <button
          onClick={() => {
            setOpenForm(true);
            resetForm();
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#1E3A5F] to-[#2f6797] px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg dark:from-[#F5A623] dark:to-[#d48b0b] dark:text-slate-900"
        >
          <Plus className="h-4 w-4" />
          Add Qualification
        </button>
      </div>

      {!isComplete && (
        <section className="rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/25 dark:text-amber-200">
          <p className="text-sm font-medium">Complete your academic profile to see courses matched to your qualifications</p>
          <button
            onClick={() => {
              setOpenForm(true);
              resetForm();
            }}
            className="mt-1 text-sm font-semibold underline"
          >
            Click here to add your qualifications
          </button>
        </section>
      )}

      {loading ? (
        <div className="glass-card rounded-xl p-6 text-sm text-slate-600 dark:text-slate-300">Loading academic profile...</div>
      ) : error ? (
        <div className="rounded-xl border border-rose-200/80 bg-rose-50/90 p-6 text-sm text-rose-700 dark:border-rose-400/40 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>
      ) : (
        <section id="qualifications" className="glass-card rounded-xl p-5">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Qualifications</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {qualifications.map((qualification) => {
              const badge = statusBadge(qualification);
              return (
                <article key={qualification.id} className="rounded-lg border border-white/40 bg-white/40 p-4 backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/30">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{qualification.qualName}</h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditQualification(qualification)}
                        className="rounded-md border border-white/50 bg-white/70 px-2.5 py-1 text-xs font-medium text-slate-700 backdrop-blur-sm hover:bg-white dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-900"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => void handleDeleteQualification(qualification.id)}
                        className="rounded-md border border-rose-300/70 bg-rose-50/80 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 dark:border-rose-400/40 dark:bg-rose-950/30 dark:text-rose-300"
                      >
                        Delete
                      </button>
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${badge.cls}`}>{badge.label}</span>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Institution: {qualification.institutionName || "-"}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">Year: {qualification.yearCompleted || "-"}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">Overall Grade: {qualification.overallGrade || "-"}</p>
                  {(qualification.transcriptUrl || qualification.certificateUrl) && (
                    <div className="mt-3 space-y-2 rounded-lg border border-white/50 bg-white/60 p-3 dark:border-white/10 dark:bg-slate-900/50">
                      {qualification.transcriptUrl && qualification.transcriptDocumentId && (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs text-slate-700 dark:text-slate-300">Transcript: {qualification.transcriptFileName || "Transcript.pdf"}</p>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setPreviewDocument({ fileUrl: qualification.transcriptUrl, fileName: qualification.transcriptFileName || "Transcript" })}
                              className="rounded-md border border-white/50 bg-white/70 px-2 py-1 text-xs font-medium text-slate-700 backdrop-blur-sm hover:bg-white dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-900"
                            >
                              Preview
                            </button>
                            <a
                              href={toApiFilesDownloadPath(qualification.transcriptUrl)}
                              className="rounded-md border border-white/50 bg-white/70 px-2 py-1 text-xs font-medium text-slate-700 backdrop-blur-sm hover:bg-white dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-900"
                            >
                              Download
                            </a>
                            <button
                              type="button"
                              onClick={() => void handleDeleteDocument(qualification.transcriptDocumentId, "transcript")}
                              className="rounded-md border border-rose-300/70 bg-rose-50/80 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 dark:border-rose-400/40 dark:bg-rose-950/30 dark:text-rose-300"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}

                      {qualification.certificateUrl && qualification.certificateDocumentId && (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs text-slate-700 dark:text-slate-300">Certificate: {qualification.certificateFileName || "Certificate.pdf"}</p>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setPreviewDocument({ fileUrl: qualification.certificateUrl, fileName: qualification.certificateFileName || "Certificate" })}
                              className="rounded-md border border-white/50 bg-white/70 px-2 py-1 text-xs font-medium text-slate-700 backdrop-blur-sm hover:bg-white dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-900"
                            >
                              Preview
                            </button>
                            <a
                              href={toApiFilesDownloadPath(qualification.certificateUrl)}
                              className="rounded-md border border-white/50 bg-white/70 px-2 py-1 text-xs font-medium text-slate-700 backdrop-blur-sm hover:bg-white dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-900"
                            >
                              Download
                            </a>
                            <button
                              type="button"
                              onClick={() => void handleDeleteDocument(qualification.certificateDocumentId, "certificate")}
                              className="rounded-md border border-rose-300/70 bg-rose-50/80 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 dark:border-rose-400/40 dark:bg-rose-950/30 dark:text-rose-300"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {qualification.subjects.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {qualification.subjects.slice(0, 3).map((subject) => (
                        <p key={subject.id} className="text-xs text-slate-600 dark:text-slate-400">
                          {subject.subjectName}: {formatTypedGrade(subject.rawGrade, subject.gradeType || inferGradeType(subject.rawGrade || ""))}
                        </p>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
            {qualifications.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">No qualifications added yet.</p>}
          </div>
        </section>
      )}

      {openForm && (
        <section className="glass-card rounded-xl p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{isEditing ? "Edit Qualification" : "Add Qualification"} (Step {step}/4)</h2>
            <button
              onClick={() => {
                setOpenForm(false);
                resetForm();
              }}
              className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              Close
            </button>
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Qualification Type</label>
                <select
                  value={qualSelection}
                  onChange={(event) => setQualSelection(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Select qualification</option>
                  {QUAL_OPTIONS.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.items.map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </optgroup>
                  ))}
                  <option value="Other (free text)">Other (free text)</option>
                </select>
              </div>

              {qualSelection === "Other (free text)" && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Other Qualification</label>
                  <input
                    value={otherQualText}
                    onChange={(event) => setOtherQualText(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              )}

              <div className="flex justify-between">
                <button
                  onClick={() => {
                    setOpenForm(false);
                    resetForm();
                  }}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setStep(2)}
                  disabled={!selectedLabel}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Institution name</label>
                  <input value={institutionName} onChange={(event) => setInstitutionName(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Country of study</label>
                  <input value={countryOfStudy} onChange={(event) => setCountryOfStudy(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Year of completion</label>
                  <input type="number" value={yearCompleted} onChange={(event) => setYearCompleted(event.target.value === "" ? "" : Number(event.target.value))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Overall GPA/Grade</label>
                <input value={overallGrade} onChange={(event) => setOverallGrade(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>

              {isYear10Or12(selectedLabel) && (
                <div className="rounded-lg border border-slate-200 p-4">
                  <p className="text-sm font-medium text-slate-800">Year 10/12 Subject Grades</p>
                  <div className="mt-3 space-y-2">
                    {manualRows.map((row, index) => (
                      <div key={`${index}-${row.subjectName}`} className="grid gap-2 md:grid-cols-6">
                        <input
                          value={row.subjectName}
                          onChange={(event) => {
                            const next = [...manualRows];
                            next[index] = { ...next[index], subjectName: event.target.value };
                            setManualRows(next);
                          }}
                          placeholder="Subject"
                          className="md:col-span-3 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        />
                        <input
                          value={row.rawGrade}
                          onChange={(event) => {
                            const next = [...manualRows];
                            next[index] = { ...next[index], rawGrade: event.target.value };
                            setManualRows(next);
                          }}
                          placeholder="Grade"
                          className="md:col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        />
                        <button
                          onClick={() => setManualRows((prev) => prev.filter((_, rowIndex) => rowIndex !== index))}
                          className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setManualRows((prev) => [...prev, { subjectName: "", rawGrade: "" }])}
                    className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                  >
                    Add Subject
                  </button>
                </div>
              )}

              {isBachelorOrMaster(selectedLabel) && (
                <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">For this qualification, overall GPA/grade is required; transcript OCR focuses on overall extraction.</p>
              )}

              <div className="flex justify-between">
                <button onClick={() => setStep(1)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Back</button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setOpenForm(false);
                      resetForm();
                    }}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                  >
                    Cancel
                  </button>
                  <button onClick={() => setStep(3)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Next</button>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const dropped = event.dataTransfer.files?.[0];
                  if (dropped) setTranscriptFile(dropped);
                }}
                className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center"
              >
                <p className="text-sm text-slate-700">Drag and drop transcript file here</p>
                <p className="mt-1 text-xs text-slate-500">or</p>
                <label className="mt-3 inline-block cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700">
                  Choose File
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(event) => setTranscriptFile(event.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => { setQrDocumentField("TRANSCRIPT"); setShowQrModal(true); }}
                  className="ml-2 inline-flex items-center gap-2 cursor-pointer rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
                >
                  📱 Take Photo with Phone via QR Code
                </button>
                {transcriptFile && <p className="mt-3 text-sm text-slate-700">Selected transcript: {transcriptFile.name}</p>}
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-medium text-slate-800">Optional qualification certificate</p>
                <p className="mt-1 text-xs text-slate-500">Upload if you have a separate certificate file.</p>
                <label className="mt-3 inline-block cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700">
                  Choose Certificate File
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(event) => setCertificateFile(event.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => { setQrDocumentField("CERTIFICATE"); setShowQrModal(true); }}
                  className="ml-2 inline-flex items-center gap-2 cursor-pointer rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
                >
                  📱 Take Photo with Phone via QR Code
                </button>
                {certificateFile && <p className="mt-2 text-sm text-slate-700">Selected certificate: {certificateFile.name}</p>}
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => void handleSaveWithoutOcr()}
                  disabled={!transcriptFile || uploading}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
                >
                  {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Without OCR
                </button>
                <button
                  onClick={handleUploadAndScan}
                  disabled={!transcriptFile || uploading}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Upload and Run OCR
                </button>
              </div>

              <div className="flex justify-start">
                <button onClick={() => setStep(2)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Back</button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Grade Type</p>
                <div className="mt-2 flex flex-wrap gap-3">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="qualification-grade-type"
                      value="GPA"
                      checked={qualificationGradeType === "GPA"}
                      onChange={() => {
                        setQualificationGradeType("GPA");
                        setOcrRows((prev) => prev.map((row) => ({ ...row, gradeType: "GPA" })));
                      }}
                    />
                    GPA Score
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="qualification-grade-type"
                      value="LETTER"
                      checked={qualificationGradeType === "LETTER"}
                      onChange={() => {
                        setQualificationGradeType("LETTER");
                        setOcrRows((prev) => prev.map((row) => ({ ...row, gradeType: "LETTER" })));
                      }}
                    />
                    Letter Grade
                  </label>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Subject Name</th>
                      <th className="px-3 py-2">Grade Type</th>
                      <th className="px-3 py-2">Grade</th>
                      <th className="px-3 py-2">Confidence</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {ocrRows.map((row, index) => (
                      <tr key={row.id} className="border-t border-slate-200">
                        <td className="px-3 py-2">
                          <input
                            value={row.subjectName}
                            onChange={(event) => {
                              const next = [...ocrRows];
                              next[index] = { ...next[index], subjectName: event.target.value };
                              setActiveInputKey(`${row.id}-subjectName`);
                              setActiveInputCaret(event.target.selectionStart ?? event.target.value.length);
                              setOcrRows(next);
                            }}
                            ref={(element) => {
                              inputRefs.current[`${row.id}-subjectName`] = element;
                            }}
                            className="w-full rounded-md border border-slate-300 px-2 py-1.5"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={row.gradeType}
                            onChange={(event) => {
                              const next = [...ocrRows];
                              next[index] = { ...next[index], gradeType: event.target.value as "GPA" | "LETTER", rawGrade: "" };
                              setOcrRows(next);
                            }}
                            className="w-full rounded-md border border-slate-300 px-2 py-1.5"
                          >
                            <option value="GPA">GPA Score</option>
                            <option value="LETTER">Letter Grade</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          {row.gradeType === "GPA" ? (
                            <>
                              <input
                                type="number"
                                min={0}
                                max={5}
                                step="0.01"
                                list={`gpa-options-${row.id}`}
                                value={row.rawGrade}
                                onChange={(event) => {
                                  const next = [...ocrRows];
                                  next[index] = { ...next[index], rawGrade: event.target.value };
                                  setActiveInputKey(`${row.id}-rawGrade`);
                                  setActiveInputCaret(event.target.selectionStart ?? event.target.value.length);
                                  setOcrRows(next);
                                }}
                                ref={(element) => {
                                  inputRefs.current[`${row.id}-rawGrade`] = element;
                                }}
                                className="w-full rounded-md border border-slate-300 px-2 py-1.5"
                              />
                              <datalist id={`gpa-options-${row.id}`}>
                                {GPA_OPTIONS.map((gpa) => (
                                  <option key={gpa} value={gpa} />
                                ))}
                              </datalist>
                            </>
                          ) : (
                            <select
                              value={row.rawGrade}
                              onChange={(event) => {
                                const next = [...ocrRows];
                                next[index] = { ...next[index], rawGrade: event.target.value };
                                setOcrRows(next);
                              }}
                              className="w-full rounded-md border border-slate-300 px-2 py-1.5"
                            >
                              <option value="">Select</option>
                              {LETTER_OPTIONS.map((grade) => (
                                <option key={grade} value={grade}>{grade}</option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${confidenceColor(row.confidence)}`} />
                            <span className="text-xs text-slate-600">{Math.round(row.confidence * 100)}%</span>
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => setOcrRows((prev) => prev.filter((_, rowIndex) => rowIndex !== index))}
                            className="inline-flex items-center justify-center rounded-md border border-rose-200 bg-rose-50 p-2 text-rose-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                onClick={() => setOcrRows((prev) => [...prev, newRow("", "", 0.5, qualificationGradeType)])}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                Add Missing Subject
              </button>

              <div className="flex flex-wrap justify-between gap-3">
                <button onClick={() => setStep(3)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Back</button>
                <button
                  onClick={saveAndNext}
                  disabled={confirming || ocrRows.length === 0}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {confirming && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save and Next
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {message && <div className="rounded-lg border border-blue-200/80 bg-blue-50/90 p-3 text-sm text-blue-800 dark:border-blue-500/30 dark:bg-blue-950/30 dark:text-blue-300">{message}</div>}

      {previewDocument && (
        <DocumentPreviewModal
          fileUrl={previewDocument.fileUrl}
          fileName={previewDocument.fileName}
          onClose={() => setPreviewDocument(null)}
        />
      )}

      <QRCodeUploadModal
        open={showQrModal}
        studentId={studentId}
        documentField={qrDocumentField}
        documentType="ACADEMIC_DOCUMENT"
        documentLabel={qrDocumentField === "TRANSCRIPT" ? "Academic Transcript" : "Qualification Certificate"}
        onClose={() => setShowQrModal(false)}
        onCompleted={async (payload) => {
          setShowQrModal(false);
          try {
            const res = await fetch(payload.fileUrl);
            const blob = await res.blob();
            const file = new File([blob], payload.fileName || `${qrDocumentField.toLowerCase()}.pdf`, { type: blob.type || "application/pdf" });
            if (qrDocumentField === "TRANSCRIPT") {
              setTranscriptFile(file);
            } else {
              setCertificateFile(file);
            }
          } catch {
            // handled silently
          }
        }}
      />
    </main>
  );
}
