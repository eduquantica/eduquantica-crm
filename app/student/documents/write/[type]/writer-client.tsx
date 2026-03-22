"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import DocumentPreviewModal from "@/components/shared/DocumentPreviewModal";
import { toApiFilesDownloadPath } from "@/lib/file-url";

type DocType = "SOP" | "PERSONAL_STATEMENT";

type GrammarIssue = {
  offset: number;
  length: number;
  message: string;
  replacements: string[];
  ruleId: string;
  category: "GRAMMAR" | "SPELLING" | "STYLE" | "PUNCTUATION" | "OTHER";
  shortMessage: string;
};

type VersionEntry = {
  id: string;
  version: number;
  content: string;
  savedAt: string;
};

type DocumentData = {
  id: string;
  documentType: DocType;
  title: string;
  content: string;
  wordCount: number;
  version: number;
  status: string;
  grammarScore: number | null;
  plagiarismScore: number | null;
  aiContentScore: number | null;
  scanStatus: string | null;
  scanReportUrl: string | null;
  convertedPdfUrl: string | null;
  updatedAt: string;
  versions: VersionEntry[];
};

type UploadedFileData = {
  id: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: string;
};

function toDocType(typeParam: string): DocType | null {
  if (typeParam === "sop") return "SOP";
  if (typeParam === "personal-statement") return "PERSONAL_STATEMENT";
  return null;
}

function countWords(content: string) {
  return (content || "").trim().split(/\s+/).filter(Boolean).length;
}

function scoreColor(score: number | null, good: number, warn: number) {
  const value = score ?? 0;
  if (value <= good) return "text-emerald-600";
  if (value <= warn) return "text-amber-600";
  return "text-red-600";
}

function wordCountColor(count: number) {
  if (count < 300) return "text-slate-500";
  if (count <= 800) return "text-emerald-600";
  return "text-amber-600";
}

export default function WriterClient({ typeParam }: { typeParam: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const grammarTimer = useRef<NodeJS.Timeout | null>(null);

  const documentType = toDocType(typeParam);
  const docIdQuery = searchParams.get("docId");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusText, setStatusText] = useState("Saved just now");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [documentId, setDocumentId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [version, setVersion] = useState(1);
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [showVersions, setShowVersions] = useState(false);

  const [issues, setIssues] = useState<GrammarIssue[]>([]);
  const [grammarScore, setGrammarScore] = useState<number | null>(null);
  const [checkingGrammar, setCheckingGrammar] = useState(false);

  const [plagiarismScore, setPlagiarismScore] = useState<number | null>(null);
  const [aiScore, setAiScore] = useState<number | null>(null);
  const [scanReportUrl, setScanReportUrl] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const [convertedPdfUrl, setConvertedPdfUrl] = useState<string | null>(null);
  const [convertingPdf, setConvertingPdf] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pendingUpload, setPendingUpload] = useState<{ fileName: string; fileUrl: string } | null>(null);
  const [uploadedFile, setUploadedFile] = useState<UploadedFileData | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ fileName: string; fileUrl: string } | null>(null);

  const wordCount = useMemo(() => countWords(content), [content]);

  const loadUploadedDocument = useCallback(async () => {
    if (!documentType) return;
    try {
      const params = new URLSearchParams({ documentType });
      const res = await fetch(`/api/student/documents/written-upload?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) return;
      setUploadedFile(json.data?.document || null);
    } catch {
      // Keep editor usable even if upload listing fails.
    }
  }, [documentType]);

  const loadDocument = useCallback(async (id: string) => {
    const res = await fetch(`/api/student/documents/written/${id}`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to load document");

    const doc = json.data as DocumentData;
    setDocumentId(doc.id);
    setTitle(doc.title);
    setContent(doc.content);
    setVersion(doc.version);
    setVersions(doc.versions || []);
    setGrammarScore(doc.grammarScore);
    setPlagiarismScore(doc.plagiarismScore);
    setAiScore(doc.aiContentScore);
    setScanReportUrl(doc.scanReportUrl);
    setScanStatus(doc.scanStatus);
    setConvertedPdfUrl(doc.convertedPdfUrl);
  }, []);

  useEffect(() => {
    if (!documentType) return;

    let mounted = true;

    async function bootstrap() {
      setLoading(true);
      setError(null);
      try {
        if (docIdQuery) {
          await loadDocument(docIdQuery);
          return;
        }

        const listRes = await fetch("/api/student/documents/written", { cache: "no-store" });
        const listJson = await listRes.json();
        if (!listRes.ok) throw new Error(listJson.error || "Failed to load documents");

        const existing = (listJson.data || []).find((doc: { documentType: DocType }) => doc.documentType === documentType);
        if (existing?.id) {
          await loadDocument(existing.id);
          return;
        }

        const createRes = await fetch("/api/student/documents/written", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentType,
            title: documentType === "SOP" ? "My SOP Draft" : "My Personal Statement Draft",
            content: "",
            applicationId: null,
          }),
        });
        const createJson = await createRes.json();
        if (!createRes.ok) throw new Error(createJson.error || "Failed to create document");

        if (mounted) {
          await loadDocument(createJson.data.id);
        }
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "Failed to open writer");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void bootstrap();
    void loadUploadedDocument();

    return () => {
      mounted = false;
    };
  }, [documentType, docIdQuery, loadDocument, loadUploadedDocument]);

  async function uploadOwnFile(file: File) {
    setError(null);
    setMessage(null);

    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (!["pdf", "docx", "doc"].includes(ext)) {
      setError("Only PDF, DOCX, and DOC files are allowed.");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("files", file);
      formData.append("preserveOriginal", "true");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok || !json.urls?.[0]) {
        throw new Error(json.error || "Upload failed");
      }

      setPendingUpload({ fileName: file.name, fileUrl: json.urls[0] });
      setMessage("File uploaded. Click Save to attach it to your record.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  }

  async function saveUploadedFile() {
    if (!documentType || !pendingUpload) return;

    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/student/documents/written-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentType,
          fileName: pendingUpload.fileName,
          fileUrl: pendingUpload.fileUrl,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save uploaded file");

      setUploadedFile(json.data.document);
      setPendingUpload(null);
      setMessage("Uploaded file saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save uploaded file");
    }
  }

  async function deleteUploadedFile() {
    if (!documentType) return;
    const confirmed = window.confirm("Are you sure you want to delete this uploaded document?");
    if (!confirmed) return;

    setError(null);
    setMessage(null);
    try {
      const params = new URLSearchParams({ documentType });
      const res = await fetch(`/api/student/documents/written-upload?${params.toString()}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to delete uploaded file");

      setUploadedFile(null);
      setPendingUpload(null);
      setMessage("Uploaded file deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete uploaded file");
    }
  }

  const saveDraft = useCallback(async (manualSave: boolean) => {
    if (!documentId) return;

    setSaving(true);
    setStatusText("Saving...");
    try {
      const res = await fetch(`/api/student/documents/written/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, manualSave }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save");

      setVersion(json.data.version);
      setStatusText("Saved just now");
      if (manualSave) {
        await loadDocument(documentId);
        setMessage("Draft saved.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setStatusText("Save failed");
    } finally {
      setSaving(false);
    }
  }, [content, documentId, loadDocument, title]);

  useEffect(() => {
    if (!documentId) return;
    const interval = setInterval(() => {
      void saveDraft(false);
    }, 30000);

    return () => clearInterval(interval);
  }, [documentId, saveDraft]);

  const runGrammarCheck = useCallback(async () => {
    if (!documentId) return;
    setCheckingGrammar(true);
    setError(null);
    try {
      await saveDraft(false);
      const res = await fetch(`/api/student/documents/written/${documentId}/grammar-check`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Grammar check failed");
      setIssues(json.data.issues || []);
      setGrammarScore(json.data.grammarScore ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Grammar check failed");
    } finally {
      setCheckingGrammar(false);
    }
  }, [documentId, saveDraft]);

  useEffect(() => {
    if (!documentId) return;

    if (grammarTimer.current) {
      clearTimeout(grammarTimer.current);
    }

    grammarTimer.current = setTimeout(() => {
      if (content.trim().length > 20) {
        void runGrammarCheck();
      }
    }, 2000);

    return () => {
      if (grammarTimer.current) clearTimeout(grammarTimer.current);
    };
  }, [content, documentId, runGrammarCheck]);

  function applySuggestion(issue: GrammarIssue, replacement: string) {
    const before = content.slice(0, issue.offset);
    const after = content.slice(issue.offset + issue.length);
    const next = `${before}${replacement}${after}`;
    setContent(next);
    setIssues((prev) => prev.filter((entry) => !(entry.offset === issue.offset && entry.length === issue.length && entry.ruleId === issue.ruleId)));
  }

  function jumpToIssue(issue: GrammarIssue) {
    const node = textareaRef.current;
    if (!node) return;
    node.focus();
    node.setSelectionRange(issue.offset, issue.offset + issue.length);
  }

  async function runScan() {
    if (!documentId) return;
    setScanning(true);
    setError(null);
    try {
      await saveDraft(false);
      const res = await fetch(`/api/student/documents/written/${documentId}/scan`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Scan failed");

      if (json.data.plagiarismScore != null) setPlagiarismScore(json.data.plagiarismScore);
      if (json.data.aiContentScore != null) setAiScore(json.data.aiContentScore);
      if (json.data.scanReportUrl) setScanReportUrl(json.data.scanReportUrl);
      setScanStatus(json.data.scanStatus || null);
      if (json.data.warning) setMessage(json.data.warning);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  async function convertPdf() {
    if (!documentId) return;
    setConvertingPdf(true);
    setError(null);
    try {
      await saveDraft(false);
      const res = await fetch(`/api/student/documents/written/${documentId}/convert-to-pdf`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "PDF conversion failed");
      setConvertedPdfUrl(json.data.pdfUrl);
      setMessage("PDF ready for download.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF conversion failed");
    } finally {
      setConvertingPdf(false);
    }
  }

  async function restoreVersion(versionId: string) {
    if (!documentId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/student/documents/written/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restoreVersionId: versionId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Restore failed");
      setContent(json.data.content);
      setVersion(json.data.version);
      setShowVersions(false);
      setMessage("Version restored successfully.");
      await loadDocument(documentId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Restore failed");
    } finally {
      setSaving(false);
    }
  }

  async function submitDocument() {
    if (!documentId) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const submit = async (payload: { skipGrammar?: boolean; skipScan?: boolean; submitHighAi?: boolean } = {}) => {
        const res = await fetch(`/api/student/documents/written/${documentId}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        return { ok: res.ok, status: res.status, json };
      };

      let result = await submit();
      if (!result.ok && result.json.code === "GRAMMAR_NOT_CHECKED") {
        const proceed = window.confirm("You have not checked grammar yet. Check grammar before submitting? Click Cancel to skip and submit.");
        if (proceed) {
          await runGrammarCheck();
          result = await submit();
        } else {
          result = await submit({ skipGrammar: true });
        }
      }

      if (!result.ok && result.json.code === "SCAN_NOT_CHECKED") {
        const proceed = window.confirm("You have not scanned for plagiarism. Scan before submitting? Click Cancel to skip and submit.");
        if (proceed) {
          await runScan();
          result = await submit();
        } else {
          result = await submit({ skipScan: true });
        }
      }

      if (!result.ok && result.json.code === "AI_HIGH_CONFIRM_REQUIRED") {
        const proceed = window.confirm("High AI content detected. Submit anyway?");
        if (proceed) {
          result = await submit({ submitHighAi: true });
        }
      }

      if (!result.ok) {
        throw new Error(result.json.error || "Submission failed");
      }

      setMessage(result.json.message || "Submitted successfully.");
      await loadDocument(documentId);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (!documentType) {
    return <div className="p-6 text-sm text-red-600">Invalid document type.</div>;
  }

  if (loading) {
    return <div className="p-6 text-sm text-slate-600">Loading editor...</div>;
  }

  return (
    <main className="mx-auto w-full max-w-[1400px] space-y-4 px-4 py-4 sm:px-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Write Your Document</h2>
              <p className="mt-1 text-sm text-slate-600">Write and refine your SOP or Personal Statement directly in the editor.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/student/write-sop"
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${documentType === "SOP" ? "bg-[#1B2A4A] text-white" : "border border-slate-300 text-slate-700"}`}
              >
                Statement of Purpose
              </Link>
              <Link
                href="/student/write-sop"
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${documentType === "PERSONAL_STATEMENT" ? "bg-[#1B2A4A] text-white" : "border border-slate-300 text-slate-700"}`}
              >
                Personal Statement
              </Link>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p className="mb-2 font-semibold text-slate-900">Writing Prompts</p>
            <ul className="space-y-1 text-xs sm:text-sm">
              <li>Introduction — Briefly introduce yourself</li>
              <li>Why This Course — Explain your interest in this subject</li>
              <li>Relevance to Your Background — How does this course relate to your previous qualifications and work experience</li>
              <li>Achievements — Any academic or professional achievements</li>
              <li>Why This University — What attracts you to this specific university</li>
              <li>Why This Country — Why you chose to study in this country</li>
              <li>Future Plans — Your career goals after completing the course</li>
              <li>Conclusion — Summarise your motivation and commitment</li>
            </ul>
            <p className="mt-3 text-xs font-medium text-slate-600">Tip: Keep your total within 700 words for best impact</p>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="min-w-[220px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Document title"
            />
            <span className={`text-sm font-semibold ${wordCountColor(wordCount)}`}>Word count: {wordCount}</span>
            {wordCount > 700 && (
              <span className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">You are approaching the recommended limit of 700 words</span>
            )}
          </div>

          <textarea
            ref={textareaRef}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            className="mt-4 min-h-[520px] w-full resize-y rounded-lg border border-slate-300 px-4 py-4 text-base leading-8 text-slate-800 outline-none focus:border-blue-400"
            placeholder="Start writing your document here..."
          />

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void runGrammarCheck()}
              disabled={checkingGrammar}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {checkingGrammar ? "Checking..." : "Grammar Check"}
            </button>
            <button
              type="button"
              onClick={() => void runScan()}
              disabled={scanning}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {scanning ? "Scanning for plagiarism and AI content..." : "Plagiarism and AI Detection Check"}
            </button>
            <button
              type="button"
              onClick={() => void saveDraft(true)}
              className="rounded-lg bg-[#1B2A4A] px-3 py-2 text-sm font-semibold text-white hover:bg-[#22375f]"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setShowVersions(true)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Version History
            </button>
            <button
              type="button"
              onClick={() => void submitDocument()}
              disabled={submitting}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {submitting ? "Submitting..." : "Submit"}
            </button>
            <span className="text-xs text-slate-500">{saving ? "Saving..." : statusText}</span>
            <span className="text-xs text-slate-500">Version: {version}</span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
              <p>Total grammar issues: {issues.length}</p>
              <p>
                Grammar score: <span className={grammarScore !== null ? (grammarScore >= 90 ? "text-emerald-600" : grammarScore >= 70 ? "text-amber-600" : "text-red-600") : "text-slate-500"}>{grammarScore ?? "-"}%</span>
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
              <p>Plagiarism score: <span className={`font-semibold ${scoreColor(plagiarismScore, 15, 30)}`}>{plagiarismScore ?? "-"}{plagiarismScore != null ? "%" : ""}</span></p>
              <p>AI score: <span className={`font-semibold ${scoreColor(aiScore, 20, 40)}`}>{aiScore ?? "-"}{aiScore != null ? "%" : ""}</span></p>
              {scanStatus && <p className="mt-1 text-slate-500">Scan status: {scanStatus}</p>}
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {issues.slice(0, 6).map((issue, index) => (
              <div key={`${issue.ruleId}-${issue.offset}-${index}`} className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs font-semibold text-slate-800">{issue.category}</p>
                <p className="mt-1 text-xs text-slate-600">{issue.shortMessage || issue.message}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => jumpToIssue(issue)}
                    className="rounded border border-slate-300 px-2 py-1 text-[11px] text-slate-700"
                  >
                    Jump
                  </button>
                  {issue.replacements.slice(0, 2).map((replacement) => (
                    <button
                      key={replacement}
                      type="button"
                      onClick={() => applySuggestion(issue, replacement)}
                      className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] text-blue-700"
                    >
                      Apply: {replacement}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setIssues((prev) => prev.filter((entry) => !(entry.offset === issue.offset && entry.length === issue.length && entry.ruleId === issue.ruleId)))}
                    className="rounded border border-slate-300 px-2 py-1 text-[11px] text-slate-700"
                  >
                    Ignore
                  </button>
                </div>
              </div>
            ))}
          </div>

          {scanReportUrl && (
            <a href={scanReportUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-medium text-blue-700 hover:underline">
              Download Full Report
            </a>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void convertPdf()}
              disabled={convertingPdf}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {convertingPdf ? "Converting..." : "Download as PDF"}
            </button>
            {convertedPdfUrl && (
              <a href={convertedPdfUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                Open PDF
              </a>
            )}
            <Link href="/student/documents" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Back to Documents
            </Link>
          </div>
        </section>

        <aside className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-semibold text-slate-900">Upload Your Document</h2>
          <p className="mt-1 text-sm text-slate-600">Upload your own SOP or Personal Statement in Word or PDF format</p>

          <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center hover:border-slate-400">
            <p className="text-sm font-medium text-slate-700">Drop a file or click to upload</p>
            <p className="mt-1 text-xs text-slate-500">Accepted: PDF, DOCX, DOC</p>
            <input
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                void uploadOwnFile(file);
                event.currentTarget.value = "";
              }}
            />
          </label>

          {(pendingUpload || uploadedFile) && (
            <div className="mt-4 rounded-lg border border-slate-200 p-3">
              <p className="text-sm font-semibold text-slate-900">{pendingUpload?.fileName || uploadedFile?.fileName}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const current = pendingUpload || uploadedFile;
                    if (!current) return;
                    setPreviewDoc({ fileName: current.fileName, fileUrl: current.fileUrl });
                  }}
                  className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Preview
                </button>
                {pendingUpload && (
                  <button
                    type="button"
                    onClick={() => void saveUploadedFile()}
                    className="rounded bg-[#1B2A4A] px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Save
                  </button>
                )}
                {uploadedFile && (
                  <a
                    href={toApiFilesDownloadPath(uploadedFile.fileUrl)}
                    className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Download
                  </a>
                )}
                {(pendingUpload || uploadedFile) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (pendingUpload && !uploadedFile) {
                        setPendingUpload(null);
                        return;
                      }
                      void deleteUploadedFile();
                    }}
                    className="rounded border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                  >
                    Delete
                  </button>
                )}
              </div>
              {uploadedFile && <p className="mt-2 text-xs text-slate-500">Saved on {new Date(uploadedFile.uploadedAt).toLocaleString("en-GB")}</p>}
            </div>
          )}
        </aside>
      </div>

      {showVersions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Version History (last 10)</h3>
              <button type="button" onClick={() => setShowVersions(false)} className="text-sm text-slate-600 hover:text-slate-900">Close</button>
            </div>

            <div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto">
              {versions.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900">Version {entry.version}</p>
                    <p className="text-xs text-slate-500">{new Date(entry.savedAt).toLocaleString("en-GB")}</p>
                  </div>
                  <p className="mt-2 text-xs text-slate-600">{countWords(entry.content)} words</p>
                  <p className="mt-1 text-xs text-slate-500">{entry.content.slice(0, 100) || "(empty)"}</p>
                  <button
                    type="button"
                    onClick={() => void restoreVersion(entry.id)}
                    className="mt-2 rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    Restore this version
                  </button>
                </div>
              ))}
              {versions.length === 0 && <p className="text-sm text-slate-500">No version history yet.</p>}
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

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}
    </main>
  );
}
