"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Eye,
  FilePenLine,
  ShieldCheck,
  SpellCheck,
  Trash2,
  Upload,
} from "lucide-react";

type SavedUpload = {
  fileName: string;
  mimeType: string;
  dataUrl: string;
  savedAt: string;
};

type AnalysisLevel = "Low" | "Medium" | "High";

type FullAnalysisResult = {
  plagiarismLikelihood: AnalysisLevel;
  plagiarismReason: string;
  aiLikelihood: AnalysisLevel;
  aiReason: string;
  grammarIssues: string[];
  writingQualityScore: number;
  suggestions: string[];
  grammarScore: number;
  checkedAt: string;
};

type GrammarResult = {
  grammarIssues: string[];
  grammarScore: number;
  checkedAt: string;
};

type FlowView = "select" | "write" | "upload";

type DocKind = "SOP" | "PERSONAL_STATEMENT";

const DRAFT_KEY = "eduquantica.sop.draft";
const DRAFT_VERSIONS_KEY = "eduquantica.sop.versions";
const UPLOAD_KEY = "eduquantica.sop.upload";

function toBlob(dataUrl: string, mimeType: string) {
  const base64 = dataUrl.split(",")[1] || "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

function formatDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.toLocaleDateString()} at ${date.toLocaleTimeString()}`;
}

function levelBadgeColor(level: AnalysisLevel) {
  if (level === "Low") return "bg-emerald-100 text-emerald-700";
  if (level === "Medium") return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

export default function WriteSopPage() {
  const [view, setView] = useState<FlowView>("select");
  const [docKind, setDocKind] = useState<DocKind>("SOP");
  const [content, setContent] = useState("");
  const [savedDraftAt, setSavedDraftAt] = useState<string | null>(null);
  const [versionHistory, setVersionHistory] = useState<Array<{ content: string; savedAt: string; docKind: DocKind }>>([]);
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [savedFile, setSavedFile] = useState<SavedUpload | null>(null);

  const [editorGrammarResult, setEditorGrammarResult] = useState<GrammarResult | null>(null);
  const [editorFullResult, setEditorFullResult] = useState<FullAnalysisResult | null>(null);
  const [uploadGrammarResult, setUploadGrammarResult] = useState<GrammarResult | null>(null);
  const [uploadFullResult, setUploadFullResult] = useState<FullAnalysisResult | null>(null);

  const [loadingGrammar, setLoadingGrammar] = useState(false);
  const [loadingFullCheck, setLoadingFullCheck] = useState(false);
  const [loadingUploadGrammar, setLoadingUploadGrammar] = useState(false);
  const [loadingUploadFull, setLoadingUploadFull] = useState(false);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wordCount = useMemo(() => {
    return content.trim() ? content.trim().split(/\s+/).length : 0;
  }, [content]);

  const typeLabel = docKind === "SOP" ? "Statement of Purpose" : "Personal Statement";
  const hasSavedDraft = Boolean(content.trim()) || Boolean(savedDraftAt);
  const hasUploadedDocument = Boolean(savedFile);

  function loadDraft() {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as { docKind?: DocKind; content?: string; savedAt?: string };
      setDocKind(parsed.docKind === "PERSONAL_STATEMENT" ? "PERSONAL_STATEMENT" : "SOP");
      setContent(parsed.content || "");
      setSavedDraftAt(parsed.savedAt || null);
    } catch {
      window.localStorage.removeItem(DRAFT_KEY);
    }
  }

  function loadVersionHistory() {
    const raw = window.localStorage.getItem(DRAFT_VERSIONS_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Array<{ content?: string; savedAt?: string; docKind?: DocKind }>;
      const normalized: Array<{ content: string; savedAt: string; docKind: DocKind }> = parsed
        .map((item): { content: string; savedAt: string; docKind: DocKind } => ({
          content: item.content || "",
          savedAt: item.savedAt || new Date().toISOString(),
          docKind: item.docKind === "PERSONAL_STATEMENT" ? "PERSONAL_STATEMENT" : "SOP",
        }))
        .filter((item) => Boolean(item.content.trim()));
      setVersionHistory(normalized);
    } catch {
      window.localStorage.removeItem(DRAFT_VERSIONS_KEY);
    }
  }

  function saveDraft() {
    const payload = {
      docKind,
      content,
      savedAt: new Date().toISOString(),
    };

    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    setSavedDraftAt(payload.savedAt);

    const nextHistory = [
      { content, savedAt: payload.savedAt, docKind },
      ...versionHistory.filter((row) => row.content !== content || row.docKind !== docKind),
    ].slice(0, 10);

    setVersionHistory(nextHistory);
    window.localStorage.setItem(DRAFT_VERSIONS_KEY, JSON.stringify(nextHistory));

    setMessage("Draft saved.");
    setError(null);
  }

  function loadUpload() {
    const raw = window.localStorage.getItem(UPLOAD_KEY);
    if (!raw) return;
    try {
      setSavedFile(JSON.parse(raw) as SavedUpload);
    } catch {
      window.localStorage.removeItem(UPLOAD_KEY);
    }
  }

  function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (!["pdf", "doc", "docx"].includes(ext)) {
      setError("Only PDF, DOCX, and DOC files are allowed.");
      return;
    }

    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setPendingFile(file);
    setPendingPreviewUrl(URL.createObjectURL(file));
    setUploadGrammarResult(null);
    setUploadFullResult(null);
    setMessage("File uploaded. Click Save to persist it.");
    setError(null);
    event.currentTarget.value = "";
  }

  async function saveUpload() {
    if (!pendingFile) return;

    const reader = new FileReader();
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.onload = () => resolve(String(reader.result || ""));
        reader.readAsDataURL(pendingFile);
      });

      const payload: SavedUpload = {
        fileName: pendingFile.name,
        mimeType: pendingFile.type || "application/octet-stream",
        dataUrl,
        savedAt: new Date().toISOString(),
      };

      window.localStorage.setItem(UPLOAD_KEY, JSON.stringify(payload));
      setSavedFile(payload);
      setPendingFile(null);
      if (pendingPreviewUrl) {
        URL.revokeObjectURL(pendingPreviewUrl);
      }
      setPendingPreviewUrl(null);
      setMessage("Upload saved.");
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save upload.");
    }
  }

  function deleteUpload() {
    setSavedFile(null);
    setPendingFile(null);
    setUploadGrammarResult(null);
    setUploadFullResult(null);
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setPendingPreviewUrl(null);
    window.localStorage.removeItem(UPLOAD_KEY);
    setMessage("Upload deleted.");
    setError(null);
  }

  function previewSavedUpload() {
    if (!savedFile) return;
    const blob = toBlob(savedFile.dataUrl, savedFile.mimeType);
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function downloadUpload() {
    if (!savedFile) return;
    const blob = toBlob(savedFile.dataUrl, savedFile.mimeType);
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = savedFile.fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function checkEditorGrammar() {
    if (!content.trim()) {
      setError("Please write some content before running grammar check.");
      return;
    }

    setLoadingGrammar(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/student/sop/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "grammar",
          source: {
            kind: "text",
            text: content,
          },
        }),
      });

      const payload = (await response.json()) as { data?: GrammarResult; error?: string };
      if (!response.ok || !payload.data) {
        throw new Error(payload.error || "Grammar check failed.");
      }

      setEditorGrammarResult(payload.data);
      setMessage("Grammar check complete.");
    } catch (checkError) {
      setError(checkError instanceof Error ? checkError.message : "Grammar check failed.");
    } finally {
      setLoadingGrammar(false);
    }
  }

  async function checkEditorFull() {
    if (!content.trim()) {
      setError("Please write some content before running plagiarism and AI check.");
      return;
    }

    setLoadingFullCheck(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/student/sop/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "full",
          source: {
            kind: "text",
            text: content,
          },
        }),
      });

      const payload = (await response.json()) as { data?: FullAnalysisResult; error?: string };
      if (!response.ok || !payload.data) {
        throw new Error(payload.error || "Plagiarism and AI check failed.");
      }

      setEditorFullResult(payload.data);
      setMessage("Plagiarism and AI check complete.");
    } catch (checkError) {
      setError(checkError instanceof Error ? checkError.message : "Plagiarism and AI check failed.");
    } finally {
      setLoadingFullCheck(false);
    }
  }

  async function checkUploadGrammar() {
    if (!savedFile) {
      setError("Please upload and save a file first.");
      return;
    }

    setLoadingUploadGrammar(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/student/sop/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "grammar",
          source: {
            kind: "upload",
            dataUrl: savedFile.dataUrl,
            fileName: savedFile.fileName,
            mimeType: savedFile.mimeType,
          },
        }),
      });

      const payload = (await response.json()) as { data?: GrammarResult; error?: string };
      if (!response.ok || !payload.data) {
        throw new Error(payload.error || "Upload grammar check failed.");
      }

      setUploadGrammarResult(payload.data);
      setMessage("Grammar check complete.");
    } catch (checkError) {
      setError(checkError instanceof Error ? checkError.message : "Upload grammar check failed.");
    } finally {
      setLoadingUploadGrammar(false);
    }
  }

  async function checkUploadFull() {
    if (!savedFile) {
      setError("Please upload and save a file first.");
      return;
    }

    setLoadingUploadFull(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/student/sop/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "full",
          source: {
            kind: "upload",
            dataUrl: savedFile.dataUrl,
            fileName: savedFile.fileName,
            mimeType: savedFile.mimeType,
          },
        }),
      });

      const payload = (await response.json()) as { data?: FullAnalysisResult; error?: string };
      if (!response.ok || !payload.data) {
        throw new Error(payload.error || "Upload plagiarism and AI check failed.");
      }

      setUploadFullResult(payload.data);
      setMessage("Plagiarism and AI check complete.");
    } catch (checkError) {
      setError(checkError instanceof Error ? checkError.message : "Upload plagiarism and AI check failed.");
    } finally {
      setLoadingUploadFull(false);
    }
  }

  async function downloadEditorAsPdf() {
    if (!content.trim()) {
      setError("Please write some content before downloading PDF.");
      return;
    }

    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/student/sop/download-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${typeLabel}`,
          typeLabel,
          content,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Failed to download PDF.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = `${typeLabel.toLowerCase().replace(/\s+/g, "-")}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage("PDF downloaded.");
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Failed to download PDF.");
    }
  }

  useEffect(() => {
    loadDraft();
    loadUpload();
    loadVersionHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto w-full max-w-5xl p-4 md:p-8">
      <header className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
        <h1 className="text-2xl font-bold text-slate-900">Write SOP</h1>
        <p className="text-sm text-slate-600">Choose how you want to prepare your Statement of Purpose or Personal Statement.</p>
      </header>

      {view === "select" && (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <article className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between">
              <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
                <FilePenLine className="h-5 w-5" />
              </div>
              {hasSavedDraft && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                </span>
              )}
            </div>
            <h2 className="mt-4 text-lg font-semibold text-slate-900">Write in Portal</h2>
            <p className="mt-1 text-sm text-slate-600">
              Write your SOP or Personal Statement directly in the editor with AI writing prompts.
            </p>
            <button
              type="button"
              onClick={() => setView("write")}
              className="mt-4 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
            >
              Start Writing
            </button>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between">
              <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
                <Upload className="h-5 w-5" />
              </div>
              {hasUploadedDocument && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                </span>
              )}
            </div>
            <h2 className="mt-4 text-lg font-semibold text-slate-900">Upload Your Document</h2>
            <p className="mt-1 text-sm text-slate-600">Upload your own SOP or Personal Statement in PDF or Word format.</p>
            <button
              type="button"
              onClick={() => setView("upload")}
              className="mt-4 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
            >
              Upload Document
            </button>
          </article>
        </section>
      )}

      {view === "write" && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 md:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-slate-900">Write Your Document</h2>
            <button
              type="button"
              onClick={() => setView("select")}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
          </div>

          <div className="mb-3 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 text-sm">
            <button
              type="button"
              onClick={() => setDocKind("SOP")}
              className={docKind === "SOP" ? "rounded-md bg-white px-3 py-1.5 font-semibold text-slate-900 shadow-sm" : "rounded-md px-3 py-1.5 text-slate-600"}
            >
              Statement of Purpose
            </button>
            <button
              type="button"
              onClick={() => setDocKind("PERSONAL_STATEMENT")}
              className={docKind === "PERSONAL_STATEMENT" ? "rounded-md bg-white px-3 py-1.5 font-semibold text-slate-900 shadow-sm" : "rounded-md px-3 py-1.5 text-slate-600"}
            >
              Personal Statement
            </button>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-semibold text-slate-900">Writing prompts</p>
            <ul className="mt-2 space-y-1 text-xs text-slate-700">
              <li>Introduction and academic background</li>
              <li>Why this course and university</li>
              <li>Relevant work or project experience</li>
              <li>Why this destination country</li>
              <li>Future goals and conclusion</li>
            </ul>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded bg-slate-100 px-2 py-1 text-slate-700">Word count: {wordCount}</span>
            <span className={wordCount > 700 ? "rounded bg-amber-100 px-2 py-1 text-amber-800" : "rounded bg-emerald-100 px-2 py-1 text-emerald-700"}>
              {wordCount > 700 ? "Over the 700-word limit tip" : "Within the 700-word limit tip"}
            </span>
          </div>

          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            className="mt-3 min-h-[460px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder={`Start writing your ${typeLabel} here...`}
          />

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void checkEditorGrammar()}
              disabled={loadingGrammar}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
            >
              <SpellCheck className="h-4 w-4" /> {loadingGrammar ? "Checking..." : "Grammar Check"}
            </button>
            <button
              type="button"
              onClick={() => void checkEditorFull()}
              disabled={loadingFullCheck}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
            >
              <ShieldCheck className="h-4 w-4" /> {loadingFullCheck ? "Checking..." : "Plagiarism and AI Detection Check"}
            </button>
            <button type="button" onClick={saveDraft} className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white">
              Save
            </button>
            <button
              type="button"
              onClick={() => setShowVersionHistory((prev) => !prev)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
            >
              Version History
            </button>
            <button
              type="button"
              onClick={() => void downloadEditorAsPdf()}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
            >
              <Download className="h-4 w-4" /> Download as PDF
            </button>
          </div>

          {showVersionHistory && (
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              {versionHistory.length === 0 && <p>No saved versions yet.</p>}
              {versionHistory.length > 0 && (
                <ul className="space-y-1">
                  {versionHistory.map((item) => (
                    <li key={`${item.savedAt}-${item.docKind}`} className="flex items-center justify-between gap-2">
                      <span>{item.docKind === "SOP" ? "Statement of Purpose" : "Personal Statement"} saved on {formatDateTime(item.savedAt)}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setDocKind(item.docKind);
                          setContent(item.content);
                          setMessage("Version restored in editor.");
                          setError(null);
                        }}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700"
                      >
                        Restore
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {(editorGrammarResult || editorFullResult) && (
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">Grammar</p>
                <p className="mt-1">Score: {editorGrammarResult?.grammarScore ?? editorFullResult?.grammarScore ?? "-"}/100</p>
                <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs">
                  {(editorGrammarResult?.grammarIssues || editorFullResult?.grammarIssues || []).map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ol>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">Plagiarism and AI</p>
                {editorFullResult ? (
                  <>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className={`rounded px-2 py-1 font-semibold ${levelBadgeColor(editorFullResult.plagiarismLikelihood)}`}>
                        Plagiarism: {editorFullResult.plagiarismLikelihood}
                      </span>
                      <span className={`rounded px-2 py-1 font-semibold ${levelBadgeColor(editorFullResult.aiLikelihood)}`}>
                        AI Content: {editorFullResult.aiLikelihood}
                      </span>
                    </div>
                    <p className="mt-2 text-xs">Writing Quality: {editorFullResult.writingQualityScore}/10</p>
                  </>
                ) : (
                  <p className="mt-1 text-xs">Run plagiarism and AI detection to view details.</p>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {view === "upload" && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 md:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Upload Your Document</h2>
              <p className="text-sm text-slate-600">Upload your SOP or Personal Statement in Word or PDF format.</p>
            </div>
            <button
              type="button"
              onClick={() => setView("select")}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
          </div>

          <label className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
            <span className="text-sm font-medium text-slate-700">Drop a file or click to upload</span>
            <span className="mt-1 text-xs text-slate-500">Accepted formats: PDF, DOCX, DOC</span>
            <input
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleUpload}
            />
          </label>

          {(pendingFile || savedFile) && (
            <div className="mt-4 rounded-lg border border-slate-200 p-3">
              <p className="text-sm font-semibold text-slate-900">{pendingFile?.name || savedFile?.fileName}</p>
              {savedFile && <p className="mt-1 text-xs text-slate-500">Saved on {formatDateTime(savedFile.savedAt)}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {pendingPreviewUrl ? (
                  <button
                    type="button"
                    onClick={() => window.open(pendingPreviewUrl, "_blank", "noopener,noreferrer")}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                  >
                    <Eye className="h-3.5 w-3.5" /> Preview
                  </button>
                ) : savedFile ? (
                  <button
                    type="button"
                    onClick={previewSavedUpload}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                  >
                    <Eye className="h-3.5 w-3.5" /> Preview
                  </button>
                ) : null}

                {pendingFile && (
                  <button
                    type="button"
                    onClick={() => void saveUpload()}
                    className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Save
                  </button>
                )}

                {savedFile && (
                  <button
                    type="button"
                    onClick={downloadUpload}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                  >
                    <Download className="h-3.5 w-3.5" /> Download
                  </button>
                )}

                <button
                  type="button"
                  onClick={deleteUpload}
                  className="inline-flex items-center gap-1 rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>

              {savedFile && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void checkUploadGrammar()}
                    disabled={loadingUploadGrammar}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60"
                  >
                    <SpellCheck className="h-3.5 w-3.5" /> {loadingUploadGrammar ? "Checking..." : "Check Grammar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void checkUploadFull()}
                    disabled={loadingUploadFull}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" /> {loadingUploadFull ? "Checking..." : "Check Plagiarism and AI"}
                  </button>
                </div>
              )}
            </div>
          )}

          {(uploadGrammarResult || uploadFullResult) && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Results</p>

              {uploadFullResult && (
                <>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className={`rounded px-2 py-1 font-semibold ${levelBadgeColor(uploadFullResult.plagiarismLikelihood)}`}>
                      Plagiarism Score: {uploadFullResult.plagiarismLikelihood}
                    </span>
                    <span className={`rounded px-2 py-1 font-semibold ${levelBadgeColor(uploadFullResult.aiLikelihood)}`}>
                      AI Content Score: {uploadFullResult.aiLikelihood}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-600">{uploadFullResult.plagiarismReason}</p>
                  <p className="mt-1 text-xs text-slate-600">{uploadFullResult.aiReason}</p>
                </>
              )}

              <p className="mt-3">Grammar Score: {uploadGrammarResult?.grammarScore ?? uploadFullResult?.grammarScore ?? "-"}/100</p>
              <p className="mt-2">Grammar Issues:</p>
              <ol className="mt-1 list-decimal space-y-1 pl-4 text-xs">
                {(uploadGrammarResult?.grammarIssues || uploadFullResult?.grammarIssues || []).map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ol>

              {uploadFullResult && (
                <>
                  <p className="mt-3">Writing Quality: {uploadFullResult.writingQualityScore}/10</p>
                  <p className="mt-2">Suggestions:</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-xs">
                    {uploadFullResult.suggestions.map((suggestion) => (
                      <li key={suggestion}>{suggestion}</li>
                    ))}
                  </ul>
                </>
              )}

              <p className="mt-3 text-xs text-slate-500">
                Checked on {formatDateTime(uploadFullResult?.checkedAt || uploadGrammarResult?.checkedAt || new Date().toISOString())}
              </p>

              <button
                type="button"
                onClick={() => {
                  if (uploadFullResult) {
                    void checkUploadFull();
                  } else {
                    void checkUploadGrammar();
                  }
                }}
                className="mt-3 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                Re-check
              </button>
            </div>
          )}
        </section>
      )}

      {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {message && <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
    </main>
  );
}
