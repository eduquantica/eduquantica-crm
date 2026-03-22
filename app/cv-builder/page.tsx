"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";

type UploadState = {
  fileName: string;
  mimeType: string;
  dataUrl: string;
  savedAt: string;
};

type CvSection = {
  profile: string;
  education: string;
  experience: string;
  skills: string;
  languages: string;
  references: string;
};

const STORAGE_KEY_UPLOAD = "eduquantica.cv.upload";
const STORAGE_KEY_CV = "eduquantica.cv.content";

function toLines(value: string) {
  return value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function safeName(input: string) {
  return input.replace(/[^a-zA-Z0-9_-]+/g, "_");
}

function dataUrlToBlob(dataUrl: string, mimeType: string) {
  const parts = dataUrl.split(",");
  const base64 = parts[1] || "";
  const byteString = atob(base64);
  const bytes = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i += 1) {
    bytes[i] = byteString.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

export default function CvBuilderPage() {
  const [studentName, setStudentName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [sections, setSections] = useState<CvSection>({
    profile: "",
    education: "",
    experience: "",
    skills: "",
    languages: "",
    references: "",
  });

  const [wordLoading, setWordLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [pendingUpload, setPendingUpload] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [savedUpload, setSavedUpload] = useState<UploadState | null>(null);

  const profileWordCount = useMemo(() => {
    return sections.profile.trim() ? sections.profile.trim().split(/\s+/).length : 0;
  }, [sections.profile]);

  useEffect(() => {
    const cachedUpload = window.localStorage.getItem(STORAGE_KEY_UPLOAD);
    if (cachedUpload) {
      try {
        setSavedUpload(JSON.parse(cachedUpload) as UploadState);
      } catch {
        window.localStorage.removeItem(STORAGE_KEY_UPLOAD);
      }
    }

    const cachedCv = window.localStorage.getItem(STORAGE_KEY_CV);
    if (cachedCv) {
      try {
        const parsed = JSON.parse(cachedCv) as {
          studentName: string;
          email: string;
          phone: string;
          sections: CvSection;
        };
        setStudentName(parsed.studentName || "");
        setEmail(parsed.email || "");
        setPhone(parsed.phone || "");
        setSections(parsed.sections || sections);
      } catch {
        window.localStorage.removeItem(STORAGE_KEY_CV);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    setError(null);
    setMessage(null);

    const file = event.target.files?.[0];
    if (!file) return;

    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (!["pdf", "doc", "docx"].includes(ext)) {
      setError("Only PDF, DOCX, and DOC files are accepted.");
      return;
    }

    if (pendingPreviewUrl) {
      URL.revokeObjectURL(pendingPreviewUrl);
    }

    setPendingUpload(file);
    setPendingPreviewUrl(URL.createObjectURL(file));
    event.currentTarget.value = "";
  }

  async function saveOwnCv() {
    if (!pendingUpload) return;
    setError(null);
    setMessage(null);

    try {
      const reader = new FileReader();
      const dataUrl: string = await new Promise((resolve, reject) => {
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.onload = () => resolve(String(reader.result || ""));
        reader.readAsDataURL(pendingUpload);
      });

      const payload: UploadState = {
        fileName: pendingUpload.name,
        mimeType: pendingUpload.type || "application/octet-stream",
        dataUrl,
        savedAt: new Date().toISOString(),
      };

      window.localStorage.setItem(STORAGE_KEY_UPLOAD, JSON.stringify(payload));
      setSavedUpload(payload);
      setPendingUpload(null);
      if (pendingPreviewUrl) {
        URL.revokeObjectURL(pendingPreviewUrl);
      }
      setPendingPreviewUrl(null);
      setMessage("Uploaded CV saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save file");
    }
  }

  function deleteOwnCv() {
    setSavedUpload(null);
    setPendingUpload(null);
    if (pendingPreviewUrl) {
      URL.revokeObjectURL(pendingPreviewUrl);
      setPendingPreviewUrl(null);
    }
    window.localStorage.removeItem(STORAGE_KEY_UPLOAD);
    setMessage("Uploaded CV deleted.");
    setError(null);
  }

  function saveDraftCv() {
    window.localStorage.setItem(
      STORAGE_KEY_CV,
      JSON.stringify({
        studentName,
        email,
        phone,
        sections,
      }),
    );
    setMessage("CV draft saved.");
    setError(null);
  }

  async function downloadWord() {
    setWordLoading(true);
    setError(null);
    setMessage(null);

    try {
      const resolvedName = studentName.trim() || "Student";
      const children: Paragraph[] = [];

      children.push(
        new Paragraph({
          children: [new TextRun({ text: `${resolvedName} CV`, bold: true, size: 34 })],
          spacing: { after: 220 },
        }),
      );

      children.push(new Paragraph({ text: `Email: ${email || "-"}` }));
      children.push(new Paragraph({ text: `Phone: ${phone || "-"}`, spacing: { after: 180 } }));

      const addBlock = (heading: string, value: string) => {
        children.push(
          new Paragraph({
            text: heading,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 180, after: 80 },
          }),
        );

        const lines = toLines(value);
        if (lines.length === 0) {
          children.push(new Paragraph({ text: "-" }));
          return;
        }

        lines.forEach((line) => children.push(new Paragraph({ text: line })));
      };

      addBlock("Profile Summary", sections.profile);
      addBlock("Education", sections.education);
      addBlock("Work Experience", sections.experience);
      addBlock("Skills", sections.skills);
      addBlock("Languages", sections.languages);
      addBlock("References", sections.references);

      const doc = new Document({ sections: [{ children }] });
      const blob = await Packer.toBlob(doc);
      const fileName = `${safeName(resolvedName)}-CV.docx`;

      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Failed to generate Word file.");
    } finally {
      setWordLoading(false);
    }
  }

  const currentUpload = pendingUpload
    ? {
        fileName: pendingUpload.name,
        mimeType: pendingUpload.type || "application/octet-stream",
        sourceUrl: pendingPreviewUrl,
      }
    : savedUpload
      ? {
          fileName: savedUpload.fileName,
          mimeType: savedUpload.mimeType,
          sourceUrl: null,
        }
      : null;

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">
      <header className="rounded-xl border border-slate-200 bg-white p-5">
        <h1 className="text-2xl font-bold text-slate-900">CV Builder</h1>
        <p className="mt-1 text-sm text-slate-600">Create your CV and export it as a Word document.</p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Student Details</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <input
            value={studentName}
            onChange={(event) => setStudentName(event.target.value)}
            placeholder="Student name"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="Phone"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">CV Sections</h2>
        <div className="mt-4 grid grid-cols-1 gap-3">
          <textarea
            value={sections.profile}
            onChange={(event) => setSections((prev) => ({ ...prev, profile: event.target.value }))}
            placeholder="Profile summary"
            className="min-h-[100px] rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <p className="text-xs text-slate-500">Profile word count: {profileWordCount}</p>
          <textarea
            value={sections.education}
            onChange={(event) => setSections((prev) => ({ ...prev, education: event.target.value }))}
            placeholder="Education (one item per line)"
            className="min-h-[100px] rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <textarea
            value={sections.experience}
            onChange={(event) => setSections((prev) => ({ ...prev, experience: event.target.value }))}
            placeholder="Work experience (one item per line)"
            className="min-h-[100px] rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <textarea
            value={sections.skills}
            onChange={(event) => setSections((prev) => ({ ...prev, skills: event.target.value }))}
            placeholder="Skills (comma or line separated)"
            className="min-h-[80px] rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <textarea
            value={sections.languages}
            onChange={(event) => setSections((prev) => ({ ...prev, languages: event.target.value }))}
            placeholder="Languages"
            className="min-h-[80px] rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <textarea
            value={sections.references}
            onChange={(event) => setSections((prev) => ({ ...prev, references: event.target.value }))}
            placeholder="References"
            className="min-h-[80px] rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={saveDraftCv}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => void downloadWord()}
            disabled={wordLoading}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {wordLoading ? "Preparing DOCX..." : "Download as Word"}
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Upload Your Own CV</h2>
        <p className="mt-1 text-sm text-slate-600">Accepted formats: PDF, DOCX, DOC</p>

        <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
          <span className="text-sm font-medium text-slate-700">Drop a file here or click to upload</span>
          <input
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFile}
          />
        </label>

        {currentUpload && (
          <div className="mt-4 rounded-lg border border-slate-200 p-3">
            <p className="text-sm font-semibold text-slate-900">{currentUpload.fileName}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {currentUpload.sourceUrl ? (
                <button
                  type="button"
                  onClick={() => window.open(currentUpload.sourceUrl || "", "_blank", "noopener,noreferrer")}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                >
                  Preview
                </button>
              ) : savedUpload ? (
                <button
                  type="button"
                  onClick={() => {
                    const blob = dataUrlToBlob(savedUpload.dataUrl, savedUpload.mimeType);
                    const url = URL.createObjectURL(blob);
                    window.open(url, "_blank", "noopener,noreferrer");
                    setTimeout(() => URL.revokeObjectURL(url), 4000);
                  }}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                >
                  Preview
                </button>
              ) : null}

              {pendingUpload && (
                <button
                  type="button"
                  onClick={() => void saveOwnCv()}
                  className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Save
                </button>
              )}

              {savedUpload && (
                <button
                  type="button"
                  onClick={() => {
                    const blob = dataUrlToBlob(savedUpload.dataUrl, savedUpload.mimeType);
                    const url = URL.createObjectURL(blob);
                    const anchor = window.document.createElement("a");
                    anchor.href = url;
                    anchor.download = savedUpload.fileName;
                    anchor.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                >
                  Download
                </button>
              )}

              <button
                type="button"
                onClick={deleteOwnCv}
                className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </section>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div>}
    </main>
  );
}
