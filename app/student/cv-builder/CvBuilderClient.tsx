"use client";

import { useEffect, useMemo, useState } from "react";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import CvPreview from "@/components/CvPreview";
import CvPdfDocument from "@/components/CvPdfDocument";
import DocumentPreviewModal from "@/components/shared/DocumentPreviewModal";
import QRCodeUploadModal from "@/components/shared/QRCodeUploadModal";
import { toApiFilesDownloadPath } from "@/lib/file-url";
import type { CvProfilePayload } from "@/lib/cv-types";

type CvBuilderClientProps = {
  roleName: string;
  studentId?: string;
};

type ApiProfileResponse = {
  data: {
    profile: CvProfilePayload & {
      id: string;
      updatedAt: string;
      education: NonNullable<CvProfilePayload["education"]>;
      workExperience: NonNullable<CvProfilePayload["workExperience"]>;
      skills: NonNullable<CvProfilePayload["skills"]>;
      languages: NonNullable<CvProfilePayload["languages"]>;
      references: NonNullable<CvProfilePayload["references"]>;
      achievements: NonNullable<CvProfilePayload["achievements"]>;
    };
    completion: { total: number };
  };
};

type SourceFileResponse = {
  data: {
    document: {
      id: string;
      fileName: string;
      fileUrl: string;
      uploadedAt: string;
    } | null;
  };
};

const SKILL_SUGGESTIONS = [
  "Microsoft Office",
  "Communication",
  "Teamwork",
  "Leadership",
  "Problem Solving",
  "Data Analysis",
  "Project Management",
  "Time Management",
  "Critical Thinking",
];

function cleanFilename(value: string) {
  return value.replace(/[^a-z0-9_\-]+/gi, "_");
}

function SectionBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass-card p-4">
      <h2 className="text-sm font-bold uppercase tracking-wide text-[#1B2A4A] dark:text-[#F5A623]">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function reorder<T>(list: T[], from: number, to: number) {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export default function CvBuilderClient({ roleName, studentId }: CvBuilderClientProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completion, setCompletion] = useState(0);
  const [autoImportPrompt, setAutoImportPrompt] = useState<null | { qualificationCount: number; languageHint: string | null }>(null);
  const [dismissedImportPrompt, setDismissedImportPrompt] = useState(false);
  const [dragEducationIndex, setDragEducationIndex] = useState<number | null>(null);
  const [dragWorkIndex, setDragWorkIndex] = useState<number | null>(null);
  const [draftSkill, setDraftSkill] = useState("");
  const [wordLoading, setWordLoading] = useState(false);
  const [pendingUpload, setPendingUpload] = useState<{ fileName: string; fileUrl: string } | null>(null);
  const [uploadedCv, setUploadedCv] = useState<{ id: string; fileName: string; fileUrl: string; uploadedAt: string } | null>(null);
  const [previewFile, setPreviewFile] = useState<{ fileName: string; fileUrl: string } | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);

  const [cv, setCv] = useState<CvProfilePayload>({
    fullName: "",
    professionalTitle: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    country: "",
    nationality: "",
    profileSummary: "",
    linkedinUrl: "",
    portfolioUrl: "",
    profilePhotoUrl: "",
    templateStyle: "modern",
    showReferences: true,
    education: [],
    workExperience: [],
    skills: [],
    languages: [],
    references: [],
    achievements: [],
  });

  const query = studentId ? `?studentId=${encodeURIComponent(studentId)}` : "";

  async function loadUploadedCv() {
    try {
      const res = await fetch(`/api/cv/profile/source-file${query}`, { cache: "no-store" });
      const json = (await res.json()) as SourceFileResponse | { error?: string };
      if (!res.ok || !("data" in json)) return;
      setUploadedCv(json.data.document);
    } catch {
      // Ignore source-file loading errors to keep the main CV builder usable.
    }
  }

  async function loadProfile() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/cv/profile${query}`, { cache: "no-store" });
      const json = (await res.json()) as ApiProfileResponse | { error?: string };
      if (!res.ok || !("data" in json)) throw new Error((json as { error?: string }).error || "Failed to load CV");
      setCv(json.data.profile);
      setCompletion(json.data.completion.total);
      await loadUploadedCv();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load CV");
    } finally {
      setLoading(false);
    }
  }

  async function handleUploadOwnCv(file: File) {
    setError(null);
    setMessage(null);

    const ext = (file.name.split(".").pop() || "").toLowerCase();
    const allowed = ["pdf", "docx", "doc"];
    if (!allowed.includes(ext)) {
      setError("Only PDF, DOCX, and DOC files are allowed.");
      return;
    }

    const formData = new FormData();
    formData.append("files", file);
    formData.append("preserveOriginal", "true");

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const json = (await res.json()) as { urls?: string[]; error?: string };
      if (!res.ok || !json.urls?.[0]) throw new Error(json.error || "Upload failed");
      setPendingUpload({ fileName: file.name, fileUrl: json.urls[0] });
      setMessage("File uploaded. Click Save to attach it to this CV profile.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  }

  async function saveUploadedCv() {
    if (!pendingUpload) return;
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/cv/profile/source-file${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pendingUpload),
      });
      const json = (await res.json()) as SourceFileResponse | { error?: string };
      if (!res.ok || !("data" in json) || !json.data.document) {
        throw new Error((json as { error?: string }).error || "Failed to save CV file");
      }
      setUploadedCv(json.data.document);
      setPendingUpload(null);
      setMessage("CV file saved successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save CV file");
    }
  }

  async function deleteUploadedCv() {
    if (!uploadedCv) return;
    const confirmed = window.confirm("Are you sure you want to delete this uploaded CV file?");
    if (!confirmed) return;

    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/cv/profile/source-file${query}`, { method: "DELETE" });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to delete CV file");
      setUploadedCv(null);
      setPendingUpload(null);
      setMessage("Uploaded CV deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete CV file");
    }
  }

  async function downloadAsWord() {
    setWordLoading(true);
    setError(null);
    setMessage(null);

    try {
      const children: Paragraph[] = [];
      const fullName = (cv.fullName || "Student").trim();

      const pushHeading = (label: string) => {
        children.push(
          new Paragraph({
            text: label,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 120 },
          }),
        );
      };

      children.push(
        new Paragraph({
          children: [new TextRun({ text: `${fullName} - CV`, bold: true, size: 32 })],
          spacing: { after: 160 },
        }),
      );

      pushHeading("Personal Information");
      const personalRows = [
        `Name: ${fullName || "-"}`,
        `Email: ${cv.email || "-"}`,
        `Phone: ${cv.phone || "-"}`,
        `Location: ${[cv.city, cv.country].filter(Boolean).join(", ") || "-"}`,
        `LinkedIn: ${cv.linkedinUrl || "-"}`,
      ];
      personalRows.forEach((row) => children.push(new Paragraph({ text: row, spacing: { after: 80 } })));

      pushHeading("Profile Summary");
      children.push(new Paragraph({ text: cv.profileSummary || "-", spacing: { after: 80 } }));

      pushHeading("Education");
      if ((cv.education || []).length === 0) {
        children.push(new Paragraph({ text: "-" }));
      } else {
        (cv.education || []).forEach((row) => {
          children.push(new Paragraph({ text: `${row.qualification || "Qualification"} - ${row.institution || "Institution"}`, spacing: { after: 40 } }));
          children.push(new Paragraph({ text: `Field: ${row.fieldOfStudy || "-"} | Grade: ${row.grade || "-"} | Period: ${row.startDate || "-"} to ${row.endDate || "-"}`, spacing: { after: 80 } }));
        });
      }

      pushHeading("Work Experience");
      if ((cv.workExperience || []).length === 0) {
        children.push(new Paragraph({ text: "-" }));
      } else {
        (cv.workExperience || []).forEach((row) => {
          children.push(new Paragraph({ text: `${row.jobTitle || "Role"} - ${row.employer || "Employer"}`, spacing: { after: 40 } }));
          children.push(new Paragraph({ text: `Location: ${row.location || "-"} | Period: ${row.startDate || "-"} to ${row.endDate || "Present"}`, spacing: { after: 40 } }));
          if (row.responsibilities) {
            children.push(new Paragraph({ text: `Responsibilities: ${row.responsibilities.replace(/\n+/g, " ")}`, spacing: { after: 40 } }));
          }
          if (row.achievements) {
            children.push(new Paragraph({ text: `Achievements: ${row.achievements.replace(/\n+/g, " ")}`, spacing: { after: 80 } }));
          }
        });
      }

      pushHeading("Skills");
      const skillsText = (cv.skills || []).map((row) => row.skillName).filter(Boolean).join(", ");
      children.push(new Paragraph({ text: skillsText || "-" }));

      pushHeading("Languages");
      if ((cv.languages || []).length === 0) {
        children.push(new Paragraph({ text: "-" }));
      } else {
        (cv.languages || []).forEach((row) => {
          children.push(new Paragraph({ text: `${row.language || "Language"} - ${row.proficiency || "-"}` }));
        });
      }

      pushHeading("Achievements");
      if ((cv.achievements || []).length === 0) {
        children.push(new Paragraph({ text: "-" }));
      } else {
        (cv.achievements || []).forEach((row) => {
          children.push(new Paragraph({ text: `${row.title || "Achievement"}${row.date ? ` (${row.date})` : ""}` }));
          if (row.description) {
            children.push(new Paragraph({ text: row.description, spacing: { after: 80 } }));
          }
        });
      }

      pushHeading("References");
      if ((cv.references || []).length === 0) {
        children.push(new Paragraph({ text: "-" }));
      } else {
        (cv.references || []).forEach((row) => {
          children.push(new Paragraph({ text: `${row.refereeName || "Referee"} - ${row.jobTitle || ""} ${row.organisation ? `(${row.organisation})` : ""}`.trim() }));
          children.push(new Paragraph({ text: `Email: ${row.email || "-"} | Phone: ${row.phone || "-"} | Relationship: ${row.relationship || "-"}`, spacing: { after: 80 } }));
        });
      }

      const doc = new Document({
        sections: [{ children }],
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = `${cleanFilename(fullName || "Student")}-CV.docx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate Word file");
    } finally {
      setWordLoading(false);
    }
  }

  useEffect(() => {
    void loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  useEffect(() => {
    if (roleName !== "STUDENT" || studentId || dismissedImportPrompt) return;
    if ((cv.education?.length || 0) > 0) return;

    let mounted = true;
    async function loadPreview() {
      const res = await fetch("/api/cv/profile/auto-import", { cache: "no-store" });
      const json = await res.json();
      if (!mounted || !res.ok) return;
      if (json.data?.qualificationCount > 0) {
        setAutoImportPrompt(json.data);
      }
    }
    void loadPreview();
    return () => {
      mounted = false;
    };
  }, [cv.education?.length, dismissedImportPrompt, roleName, studentId]);

  async function saveCv() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/cv/profile${query}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cv),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save CV");
      setCompletion(json.data.completion.total);
      setMessage("CV saved successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save CV");
    } finally {
      setSaving(false);
    }
  }

  async function generateSummary() {
    setGenerating(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/cv/profile/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(studentId ? { studentId } : {}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to generate summary");
      setCv((prev) => ({ ...prev, profileSummary: json.data.summary }));
      setMessage("Profile summary generated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate summary");
    } finally {
      setGenerating(false);
    }
  }

  async function runAutoImport() {
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/cv/profile/auto-import", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to import data");
      setAutoImportPrompt(null);
      await loadProfile();
      const workCount = Number(json.data.importedWorkExperience || 0);
      const workSuffix = workCount > 0 ? ` and ${workCount} work experience entr${workCount === 1 ? "y" : "ies"}` : "";
      setMessage(`Imported ${json.data.importedQualifications} qualifications${workSuffix} from your profile data.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import data");
    }
  }

  const profileWordCount = useMemo(() => (cv.profileSummary || "").trim().split(/\s+/).filter(Boolean).length, [cv.profileSummary]);

  if (loading) {
    return (
      <div className="min-h-screen student-dashboard-bg flex items-center justify-center">
        <div className="glass-card p-6 text-sm text-slate-600 dark:text-slate-300">Loading CV builder...</div>
      </div>
    );
  }

  const cvForPreview = {
    fullName: cv.fullName,
    professionalTitle: cv.professionalTitle,
    email: cv.email,
    phone: cv.phone,
    city: cv.city,
    country: cv.country,
    linkedinUrl: cv.linkedinUrl,
    portfolioUrl: cv.portfolioUrl,
    profileSummary: cv.profileSummary,
    showReferences: cv.showReferences,
    education: cv.education || [],
    workExperience: cv.workExperience || [],
    skills: cv.skills || [],
    languages: cv.languages || [],
    achievements: cv.achievements || [],
    references: cv.references || [],
  };

  const filename = `${cleanFilename(cv.fullName || "EduQuantica")}_CV_${new Date().toISOString().slice(0, 10)}.pdf`;

  return (
    <div className="min-h-screen student-dashboard-bg">
    <div className="space-y-4 px-4 py-6 sm:px-6">
      <div className="glass-card flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h1 className="text-xl font-bold text-[#1B2A4A] dark:text-[#F5A623]">CV Builder</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">Completion: {completion}%</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={saveCv}
            disabled={saving}
            className="gradient-btn rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save CV"}
          </button>
          <PDFDownloadLink
            document={<CvPdfDocument cv={cvForPreview} />}
            fileName={filename}
            className="rounded-lg bg-[#F5A623] px-4 py-2 text-sm font-semibold text-white"
          >
            {({ loading: pdfLoading }) => (pdfLoading ? "Preparing PDF..." : "Download CV")}
          </PDFDownloadLink>
          <button
            type="button"
            onClick={() => void downloadAsWord()}
            disabled={wordLoading}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {wordLoading ? "Preparing DOCX..." : "Download as Word"}
          </button>
        </div>
      </div>

      <section className="glass-card p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[#1B2A4A] dark:text-[#F5A623]">Upload Your Own CV</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Already have a CV? Upload it here. You can still use the CV builder below.</p>
        <label className="mt-3 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center hover:border-slate-400">
          <p className="text-sm font-medium text-slate-700">Drop a file or click to upload</p>
          <p className="mt-1 text-xs text-slate-500">Accepted: PDF, DOCX, DOC</p>
          <input
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void handleUploadOwnCv(file);
              event.currentTarget.value = "";
            }}
          />
        </label>
        {studentId && (
          <button
            type="button"
            onClick={() => setShowQrModal(true)}
            className="mt-2 flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 cursor-pointer w-full justify-center"
          >
            📱 Take Photo with Phone via QR Code
          </button>
        )}

        {(pendingUpload || uploadedCv) && (
          <div className="mt-3 rounded-lg border border-slate-200 p-3">
            <p className="text-sm font-semibold text-slate-900">{pendingUpload?.fileName || uploadedCv?.fileName}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  const current = pendingUpload || uploadedCv;
                  if (!current) return;
                  setPreviewFile({ fileName: current.fileName, fileUrl: current.fileUrl });
                }}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                Preview
              </button>
              {pendingUpload && (
                <button
                  type="button"
                  onClick={() => void saveUploadedCv()}
                  className="rounded-md bg-[#1B2A4A] px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Save
                </button>
              )}
              {uploadedCv && (
                <a
                  href={toApiFilesDownloadPath(uploadedCv.fileUrl)}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                >
                  Download
                </a>
              )}
              {(uploadedCv || pendingUpload) && (
                <button
                  type="button"
                  onClick={() => {
                    if (pendingUpload && !uploadedCv) {
                      setPendingUpload(null);
                      return;
                    }
                    void deleteUploadedCv();
                  }}
                  className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {autoImportPrompt && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p>
            We found <strong>{autoImportPrompt.qualificationCount}</strong> qualifications from your uploaded documents.
            {autoImportPrompt.languageHint ? ` English score detected: ${autoImportPrompt.languageHint}.` : ""}
            {" "}Would you like to import them automatically?
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={runAutoImport} className="rounded-md bg-[#1B2A4A] px-3 py-1.5 text-xs font-semibold text-white">Yes Import</button>
            <button type="button" onClick={() => { setDismissedImportPrompt(true); setAutoImportPrompt(null); }} className="rounded-md border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-900">No Thanks</button>
          </div>
        </div>
      )}

      {message ? <div className="rounded-md border border-emerald-200/80 bg-emerald-50/90 dark:border-emerald-400/30 dark:bg-emerald-900/30 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300">{message}</div> : null}
      {error ? <div className="rounded-md border border-red-200/80 bg-red-50/90 dark:border-red-400/30 dark:bg-red-900/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</div> : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <div className="space-y-4 xl:col-span-3">
          <SectionBox title="Personal Information">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <input className="rounded-md border px-3 py-2 text-sm" placeholder="Full Name" value={cv.fullName || ""} onChange={(e) => setCv((prev) => ({ ...prev, fullName: e.target.value }))} />
              <input className="rounded-md border px-3 py-2 text-sm" placeholder="Professional Title" value={cv.professionalTitle || ""} onChange={(e) => setCv((prev) => ({ ...prev, professionalTitle: e.target.value }))} />
              <input className="rounded-md border px-3 py-2 text-sm" placeholder="Email" value={cv.email || ""} onChange={(e) => setCv((prev) => ({ ...prev, email: e.target.value }))} />
              <input className="rounded-md border px-3 py-2 text-sm" placeholder="Phone" value={cv.phone || ""} onChange={(e) => setCv((prev) => ({ ...prev, phone: e.target.value }))} />
              <input className="rounded-md border px-3 py-2 text-sm" placeholder="Address" value={cv.address || ""} onChange={(e) => setCv((prev) => ({ ...prev, address: e.target.value }))} />
              <input className="rounded-md border px-3 py-2 text-sm" placeholder="City" value={cv.city || ""} onChange={(e) => setCv((prev) => ({ ...prev, city: e.target.value }))} />
              <input className="rounded-md border px-3 py-2 text-sm" placeholder="Country" value={cv.country || ""} onChange={(e) => setCv((prev) => ({ ...prev, country: e.target.value }))} />
              <input className="rounded-md border px-3 py-2 text-sm" placeholder="LinkedIn URL" value={cv.linkedinUrl || ""} onChange={(e) => setCv((prev) => ({ ...prev, linkedinUrl: e.target.value }))} />
              <input className="rounded-md border px-3 py-2 text-sm md:col-span-2" placeholder="Portfolio URL" value={cv.portfolioUrl || ""} onChange={(e) => setCv((prev) => ({ ...prev, portfolioUrl: e.target.value }))} />
            </div>
          </SectionBox>

          <SectionBox title="Profile Summary">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={generateSummary} disabled={generating} className="rounded-md bg-[#F5A623] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
                {generating ? "Generating..." : "Generate Profile Summary"}
              </button>
              <p className="text-xs text-slate-600">Keep between 50-100 words. Write in third person.</p>
            </div>
            <textarea
              className="min-h-[120px] w-full rounded-md border px-3 py-2 text-sm"
              value={cv.profileSummary || ""}
              onChange={(e) => setCv((prev) => ({ ...prev, profileSummary: e.target.value }))}
            />
            <p className="text-xs text-slate-500">Word count: {profileWordCount}</p>
          </SectionBox>

          <SectionBox title="Education">
            {(cv.education || []).map((row, index) => (
              <div
                key={`edu-${index}`}
                className="rounded-lg border border-slate-200 p-3"
                draggable
                onDragStart={() => setDragEducationIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragEducationIndex === null || dragEducationIndex === index) return;
                  setCv((prev) => ({ ...prev, education: reorder(prev.education || [], dragEducationIndex, index) }));
                  setDragEducationIndex(null);
                }}
              >
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <input className="rounded-md border px-2 py-1.5 text-sm" placeholder="Institution" value={row.institution || ""} onChange={(e) => setCv((prev) => ({ ...prev, education: (prev.education || []).map((r, i) => i === index ? { ...r, institution: e.target.value } : r) }))} />
                  <input className="rounded-md border px-2 py-1.5 text-sm" placeholder="Qualification" value={row.qualification || ""} onChange={(e) => setCv((prev) => ({ ...prev, education: (prev.education || []).map((r, i) => i === index ? { ...r, qualification: e.target.value } : r) }))} />
                  <input className="rounded-md border px-2 py-1.5 text-sm" placeholder="Field of Study" value={row.fieldOfStudy || ""} onChange={(e) => setCv((prev) => ({ ...prev, education: (prev.education || []).map((r, i) => i === index ? { ...r, fieldOfStudy: e.target.value } : r) }))} />
                  <input className="rounded-md border px-2 py-1.5 text-sm" placeholder="Grade/Result" value={row.grade || ""} onChange={(e) => setCv((prev) => ({ ...prev, education: (prev.education || []).map((r, i) => i === index ? { ...r, grade: e.target.value } : r) }))} />
                  <input className="rounded-md border px-2 py-1.5 text-sm" placeholder="Start Date" value={row.startDate || ""} onChange={(e) => setCv((prev) => ({ ...prev, education: (prev.education || []).map((r, i) => i === index ? { ...r, startDate: e.target.value } : r) }))} />
                  <input className="rounded-md border px-2 py-1.5 text-sm" placeholder="End Date" value={row.endDate || ""} onChange={(e) => setCv((prev) => ({ ...prev, education: (prev.education || []).map((r, i) => i === index ? { ...r, endDate: e.target.value } : r) }))} />
                </div>
                {row.autoImported ? <p className="mt-2 text-xs font-semibold text-amber-700">Auto-imported from OCR</p> : null}
                <button type="button" className="mt-2 text-xs text-red-600" onClick={() => setCv((prev) => ({ ...prev, education: (prev.education || []).filter((_, i) => i !== index) }))}>Delete</button>
              </div>
            ))}
            <button type="button" onClick={() => setCv((prev) => ({ ...prev, education: [...(prev.education || []), { institution: "", qualification: "" }] }))} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold">Add Education</button>
          </SectionBox>

          <SectionBox title="Work Experience">
            {(cv.workExperience || []).map((row, index) => (
              <div
                key={`work-${index}`}
                className="rounded-lg border border-slate-200 p-3"
                draggable
                onDragStart={() => setDragWorkIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragWorkIndex === null || dragWorkIndex === index) return;
                  setCv((prev) => ({ ...prev, workExperience: reorder(prev.workExperience || [], dragWorkIndex, index) }));
                  setDragWorkIndex(null);
                }}
              >
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <input className="rounded-md border px-2 py-1.5 text-sm" placeholder="Job Title" value={row.jobTitle || ""} onChange={(e) => setCv((prev) => ({ ...prev, workExperience: (prev.workExperience || []).map((r, i) => i === index ? { ...r, jobTitle: e.target.value } : r) }))} />
                  <input className="rounded-md border px-2 py-1.5 text-sm" placeholder="Employer" value={row.employer || ""} onChange={(e) => setCv((prev) => ({ ...prev, workExperience: (prev.workExperience || []).map((r, i) => i === index ? { ...r, employer: e.target.value } : r) }))} />
                  <input className="rounded-md border px-2 py-1.5 text-sm" placeholder="Location" value={row.location || ""} onChange={(e) => setCv((prev) => ({ ...prev, workExperience: (prev.workExperience || []).map((r, i) => i === index ? { ...r, location: e.target.value } : r) }))} />
                  <input className="rounded-md border px-2 py-1.5 text-sm" placeholder="Start Date" value={row.startDate || ""} onChange={(e) => setCv((prev) => ({ ...prev, workExperience: (prev.workExperience || []).map((r, i) => i === index ? { ...r, startDate: e.target.value } : r) }))} />
                </div>
                <textarea className="mt-2 min-h-[72px] w-full rounded-md border px-2 py-1.5 text-sm" placeholder="Responsibilities (one per line)" value={row.responsibilities || ""} onChange={(e) => setCv((prev) => ({ ...prev, workExperience: (prev.workExperience || []).map((r, i) => i === index ? { ...r, responsibilities: e.target.value } : r) }))} />
                <textarea className="mt-2 min-h-[72px] w-full rounded-md border px-2 py-1.5 text-sm" placeholder="Key achievements (one per line)" value={row.achievements || ""} onChange={(e) => setCv((prev) => ({ ...prev, workExperience: (prev.workExperience || []).map((r, i) => i === index ? { ...r, achievements: e.target.value } : r) }))} />
                <button type="button" className="mt-2 text-xs text-red-600" onClick={() => setCv((prev) => ({ ...prev, workExperience: (prev.workExperience || []).filter((_, i) => i !== index) }))}>Delete</button>
              </div>
            ))}
            <button type="button" onClick={() => setCv((prev) => ({ ...prev, workExperience: [...(prev.workExperience || []), { jobTitle: "", employer: "" }] }))} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold">Add Work Experience</button>
          </SectionBox>

          <SectionBox title="Skills">
            <div className="flex flex-wrap gap-2">
              {SKILL_SUGGESTIONS.map((skill) => (
                <button key={skill} type="button" className="rounded-full border border-slate-300 px-2 py-1 text-xs" onClick={() => {
                  if ((cv.skills || []).some((s) => s.skillName.toLowerCase() === skill.toLowerCase())) return;
                  setCv((prev) => ({ ...prev, skills: [...(prev.skills || []), { skillName: skill, proficiency: "Intermediate", category: "Soft Skills" }] }));
                }}>{skill}</button>
              ))}
            </div>
            <div className="flex gap-2">
              <input className="flex-1 rounded-md border px-3 py-2 text-sm" placeholder="Type skill and press Add" value={draftSkill} onChange={(e) => setDraftSkill(e.target.value)} onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                if (!draftSkill.trim()) return;
                setCv((prev) => ({ ...prev, skills: [...(prev.skills || []), { skillName: draftSkill.trim(), proficiency: "Intermediate", category: "Other" }] }));
                setDraftSkill("");
              }} />
              <button type="button" className="rounded-md border border-slate-300 px-3 text-xs font-semibold" onClick={() => {
                if (!draftSkill.trim()) return;
                setCv((prev) => ({ ...prev, skills: [...(prev.skills || []), { skillName: draftSkill.trim(), proficiency: "Intermediate", category: "Other" }] }));
                setDraftSkill("");
              }}>Add</button>
            </div>
            {(cv.skills || []).map((row, index) => (
              <div key={`${row.skillName}-${index}`} className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-2 md:grid-cols-4">
                <input className="rounded border px-2 py-1 text-sm" value={row.skillName} onChange={(e) => setCv((prev) => ({ ...prev, skills: (prev.skills || []).map((r, i) => i === index ? { ...r, skillName: e.target.value } : r) }))} />
                <select className="rounded border px-2 py-1 text-sm" value={row.proficiency || "Intermediate"} onChange={(e) => setCv((prev) => ({ ...prev, skills: (prev.skills || []).map((r, i) => i === index ? { ...r, proficiency: e.target.value } : r) }))}>
                  <option>Beginner</option>
                  <option>Intermediate</option>
                  <option>Advanced</option>
                  <option>Expert</option>
                </select>
                <select className="rounded border px-2 py-1 text-sm" value={row.category || "Other"} onChange={(e) => setCv((prev) => ({ ...prev, skills: (prev.skills || []).map((r, i) => i === index ? { ...r, category: e.target.value } : r) }))}>
                  <option>Technical</option>
                  <option>Soft Skills</option>
                  <option>Industry</option>
                  <option>Other</option>
                </select>
                <button type="button" className="rounded border border-red-300 px-2 py-1 text-xs text-red-600" onClick={() => setCv((prev) => ({ ...prev, skills: (prev.skills || []).filter((_, i) => i !== index) }))}>Delete</button>
              </div>
            ))}
          </SectionBox>

          <SectionBox title="Languages">
            {(cv.languages || []).map((row, index) => (
              <div key={`${row.language}-${index}`} className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <input className="rounded border px-2 py-1.5 text-sm" placeholder="Language" value={row.language} onChange={(e) => setCv((prev) => ({ ...prev, languages: (prev.languages || []).map((r, i) => i === index ? { ...r, language: e.target.value } : r) }))} />
                <select className="rounded border px-2 py-1.5 text-sm" value={row.proficiency} onChange={(e) => setCv((prev) => ({ ...prev, languages: (prev.languages || []).map((r, i) => i === index ? { ...r, proficiency: e.target.value } : r) }))}>
                  <option>Native</option>
                  <option>Fluent</option>
                  <option>Advanced</option>
                  <option>Intermediate</option>
                  <option>Basic</option>
                </select>
                <button type="button" className="rounded border border-red-300 px-2 py-1.5 text-xs text-red-600" onClick={() => setCv((prev) => ({ ...prev, languages: (prev.languages || []).filter((_, i) => i !== index) }))}>Delete</button>
              </div>
            ))}
            <button type="button" onClick={() => setCv((prev) => ({ ...prev, languages: [...(prev.languages || []), { language: "", proficiency: "Intermediate" }] }))} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold">Add Language</button>
          </SectionBox>

          <SectionBox title="Achievements and Awards">
            {(cv.achievements || []).map((row, index) => (
              <div key={`${row.title}-${index}`} className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-2 md:grid-cols-3">
                <input className="rounded border px-2 py-1.5 text-sm" placeholder="Title" value={row.title} onChange={(e) => setCv((prev) => ({ ...prev, achievements: (prev.achievements || []).map((r, i) => i === index ? { ...r, title: e.target.value } : r) }))} />
                <input className="rounded border px-2 py-1.5 text-sm" placeholder="Date" value={row.date || ""} onChange={(e) => setCv((prev) => ({ ...prev, achievements: (prev.achievements || []).map((r, i) => i === index ? { ...r, date: e.target.value } : r) }))} />
                <button type="button" className="rounded border border-red-300 px-2 py-1.5 text-xs text-red-600" onClick={() => setCv((prev) => ({ ...prev, achievements: (prev.achievements || []).filter((_, i) => i !== index) }))}>Delete</button>
                <textarea className="md:col-span-3 min-h-[64px] rounded border px-2 py-1.5 text-sm" placeholder="Description" value={row.description || ""} onChange={(e) => setCv((prev) => ({ ...prev, achievements: (prev.achievements || []).map((r, i) => i === index ? { ...r, description: e.target.value } : r) }))} />
              </div>
            ))}
            <button type="button" onClick={() => setCv((prev) => ({ ...prev, achievements: [...(prev.achievements || []), { title: "" }] }))} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold">Add Achievement</button>
          </SectionBox>

          <SectionBox title="References">
            <div className="flex items-center gap-2 text-sm">
              <input id="showReferences" type="checkbox" checked={cv.showReferences ?? true} onChange={(e) => setCv((prev) => ({ ...prev, showReferences: e.target.checked }))} />
              <label htmlFor="showReferences">Show references details (untick for &quot;Available on Request&quot;)</label>
            </div>
            {(cv.references || []).map((row, index) => (
              <div key={`${row.refereeName}-${index}`} className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-2 md:grid-cols-3">
                <input className="rounded border px-2 py-1.5 text-sm" placeholder="Referee Name" value={row.refereeName} onChange={(e) => setCv((prev) => ({ ...prev, references: (prev.references || []).map((r, i) => i === index ? { ...r, refereeName: e.target.value } : r) }))} />
                <input className="rounded border px-2 py-1.5 text-sm" placeholder="Job Title" value={row.jobTitle || ""} onChange={(e) => setCv((prev) => ({ ...prev, references: (prev.references || []).map((r, i) => i === index ? { ...r, jobTitle: e.target.value } : r) }))} />
                <input className="rounded border px-2 py-1.5 text-sm" placeholder="Organisation" value={row.organisation || ""} onChange={(e) => setCv((prev) => ({ ...prev, references: (prev.references || []).map((r, i) => i === index ? { ...r, organisation: e.target.value } : r) }))} />
                <input className="rounded border px-2 py-1.5 text-sm" placeholder="Email" value={row.email || ""} onChange={(e) => setCv((prev) => ({ ...prev, references: (prev.references || []).map((r, i) => i === index ? { ...r, email: e.target.value } : r) }))} />
                <input className="rounded border px-2 py-1.5 text-sm" placeholder="Phone" value={row.phone || ""} onChange={(e) => setCv((prev) => ({ ...prev, references: (prev.references || []).map((r, i) => i === index ? { ...r, phone: e.target.value } : r) }))} />
                <input className="rounded border px-2 py-1.5 text-sm" placeholder="Relationship" value={row.relationship || ""} onChange={(e) => setCv((prev) => ({ ...prev, references: (prev.references || []).map((r, i) => i === index ? { ...r, relationship: e.target.value } : r) }))} />
                <button type="button" className="md:col-span-3 rounded border border-red-300 px-2 py-1.5 text-xs text-red-600" onClick={() => setCv((prev) => ({ ...prev, references: (prev.references || []).filter((_, i) => i !== index) }))}>Delete</button>
              </div>
            ))}
            <button type="button" onClick={() => setCv((prev) => ({ ...prev, references: [...(prev.references || []), { refereeName: "" }] }))} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold">Add Reference</button>
          </SectionBox>
        </div>

        <div className="xl:col-span-2">
          <div className="sticky top-4">
            <CvPreview cv={cvForPreview} />
          </div>
        </div>
      </div>

      {previewFile && (
        <DocumentPreviewModal
          fileUrl={previewFile.fileUrl}
          fileName={previewFile.fileName}
          onClose={() => setPreviewFile(null)}
        />
      )}

      {studentId && (
        <QRCodeUploadModal
          open={showQrModal}
          studentId={studentId}
          documentField="CV"
          documentType="CV"
          documentLabel="Curriculum Vitae"
          onClose={() => setShowQrModal(false)}
          onCompleted={async (payload) => {
            setShowQrModal(false);
            try {
              const res = await fetch(payload.fileUrl);
              const blob = await res.blob();
              const file = new File([blob], payload.fileName || "cv.pdf", { type: blob.type || "application/pdf" });
              await handleUploadOwnCv(file);
            } catch {
              // handled silently
            }
          }}
        />
      )}
    </div>
    </div>
  );
}
