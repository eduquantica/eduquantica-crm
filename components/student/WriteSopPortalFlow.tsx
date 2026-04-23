"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, Download, Eye, FileText, Pencil, ShieldCheck, SpellCheck, Trash2, Upload } from "lucide-react";
import QRCodeUploadModal from "@/components/shared/QRCodeUploadModal";

type SavedUpload = {
  fileName: string;
  mimeType: string;
  dataUrl: string;
  savedAt: string;
};

type AnalysisLevel = "Low" | "Medium" | "High";

type SpellingIssue = {
  word: string;
  suggestion: string;
  context: string;
};

type GrammarIssue = {
  original: string;
  suggestion: string;
  explanation: string;
  context: string;
};

type SentenceIssue = {
  issue: string;
  original: string;
  suggestion: string;
  context: string;
};

type GrammarResult = {
  score: number;
  spellingErrors: SpellingIssue[];
  grammarErrors: GrammarIssue[];
  sentenceStructure: SentenceIssue[];
  improvedVersion: string;
  overallFeedback: string;
  checkedAt: string;
};

type FullResult = {
  plagiarismLikelihood: AnalysisLevel;
  plagiarismReason: string;
  aiLikelihood: AnalysisLevel;
  aiReason: string;
  writingQuality: number;
  suggestions: string[];
  authenticityScore: number;
  checkedAt: string;
};

type RealtimeMatchRaw = {
  offset: number;
  length: number;
  message: string;
  replacements: Array<{ value: string }>;
  rule?: { id: string; issueType?: string; category?: { id: string } };
};

type RealtimeMatch = {
  offset: number;
  length: number;
  message: string;
  replacements: string[];
  ruleId: string;
  issueType: "spelling" | "grammar" | "style";
};

type FlowView = "select" | "write" | "upload";
type DocKind = "SOP" | "PERSONAL_STATEMENT";

const WRITING_PROMPTS = [
  { icon: "📝", heading: "Introduction", detail: "Briefly introduce yourself and your background" },
  { icon: "🎯", heading: "Why This Course", detail: "Your interest in this subject and what draws you to it" },
  { icon: "📚", heading: "Relevance to Background", detail: "How this relates to your qualifications and work experience" },
  { icon: "🏆", heading: "Achievements", detail: "Academic or professional achievements that set you apart" },
  { icon: "🏛️", heading: "Why This University", detail: "What specifically attracts you to this institution" },
  { icon: "🌍", heading: "Why This Country", detail: "Your reasons for choosing to study in this country" },
  { icon: "🚀", heading: "Future Plans", detail: "Career goals and aspirations after completing the course" },
  { icon: "✅", heading: "Conclusion", detail: "Summarise your motivation and commitment" },
];

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

function grammarScoreColor(score: number) {
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-amber-600";
  return "text-red-600";
}

function inferExt(name: string) {
  return (name.split(".").pop() || "").toLowerCase();
}

export default function WriteSopPortalFlow() {
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
  const [editorFullResult, setEditorFullResult] = useState<FullResult | null>(null);
  const [uploadGrammarResult, setUploadGrammarResult] = useState<GrammarResult | null>(null);
  const [uploadFullResult, setUploadFullResult] = useState<FullResult | null>(null);

  const [loadingGrammar, setLoadingGrammar] = useState(false);
  const [loadingFullCheck, setLoadingFullCheck] = useState(false);
  const [loadingUploadGrammar, setLoadingUploadGrammar] = useState(false);
  const [loadingUploadFull, setLoadingUploadFull] = useState(false);
  const [downloadingCorrected, setDownloadingCorrected] = useState(false);

  const [realtimeMatches, setRealtimeMatches] = useState<RealtimeMatch[]>([]);
  const [realtimeChecking, setRealtimeChecking] = useState(false);
  const [expandedRtMatchIdx, setExpandedRtMatchIdx] = useState<number | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string>("");
  const [sopDocStatus, setSopDocStatus] = useState<"none" | "saved" | "verified">("none");
  const [sopDocSavedAt, setSopDocSavedAt] = useState<string | null>(null);
  const [savingToDocuments, setSavingToDocuments] = useState(false);
  const [savedToDocuments, setSavedToDocuments] = useState(false);
  const [showSopQrModal, setShowSopQrModal] = useState(false);

  const wordCount = useMemo(() => (content.trim() ? content.trim().split(/\s+/).length : 0), [content]);
  const typeLabel = docKind === "SOP" ? "Statement of Purpose" : "Personal Statement";

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
    const payload = { docKind, content, savedAt: new Date().toISOString() };
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    setSavedDraftAt(payload.savedAt);

    const nextHistory = [
      { content, savedAt: payload.savedAt, docKind },
      ...versionHistory.filter((item) => item.content !== content || item.docKind !== docKind),
    ].slice(0, 10);

    setVersionHistory(nextHistory);
    window.localStorage.setItem(DRAFT_VERSIONS_KEY, JSON.stringify(nextHistory));
    setMessage("Draft saved.");
    setError(null);
    // Also persist to Documents section (non-blocking, quiet)
    if (content.trim()) void saveToDocuments(true);
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

    const ext = inferExt(file.name);
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
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
      setPendingPreviewUrl(null);
      setMessage("Upload saved.");
      setError(null);
      // Also persist to Documents section (non-blocking)
      void saveUploadToDocuments(pendingFile);
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

  async function extractSavedUploadText() {
    if (!savedFile) throw new Error("Please upload and save a file first.");

    const response = await fetch("/api/sop/extract-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileUrl: savedFile.dataUrl }),
    });

    const payload = (await response.json()) as { text?: string; error?: string };
    if (!response.ok || !payload.text) {
      throw new Error(payload.error || "Unable to extract text from uploaded document.");
    }

    return payload.text;
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
        body: JSON.stringify({ mode: "grammar", source: { kind: "text", text: content } }),
      });

      const payload = (await response.json()) as { data?: GrammarResult; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || "Grammar check failed.");

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
        body: JSON.stringify({ mode: "full", source: { kind: "text", text: content } }),
      });

      const payload = (await response.json()) as { data?: FullResult; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || "Plagiarism and AI check failed.");

      setEditorFullResult(payload.data);
      setMessage("Plagiarism and AI check complete.");
    } catch (checkError) {
      setError(checkError instanceof Error ? checkError.message : "Plagiarism and AI check failed.");
    } finally {
      setLoadingFullCheck(false);
    }
  }

  async function checkUploadGrammar() {
    setLoadingUploadGrammar(true);
    setError(null);
    setMessage(null);
    try {
      const extractedText = await extractSavedUploadText();
      const response = await fetch("/api/student/sop/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "grammar", source: { kind: "text", text: extractedText } }),
      });

      const payload = (await response.json()) as { data?: GrammarResult; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || "Upload grammar check failed.");

      setUploadGrammarResult(payload.data);
      setMessage("Grammar check complete.");
    } catch (checkError) {
      setError(checkError instanceof Error ? checkError.message : "Upload grammar check failed.");
    } finally {
      setLoadingUploadGrammar(false);
    }
  }

  async function checkUploadFull() {
    setLoadingUploadFull(true);
    setError(null);
    setMessage(null);
    try {
      const extractedText = await extractSavedUploadText();
      const response = await fetch("/api/student/sop/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "full", source: { kind: "text", text: extractedText } }),
      });

      const payload = (await response.json()) as { data?: FullResult; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || "Upload plagiarism and AI check failed.");

      setUploadFullResult(payload.data);
      setMessage("Plagiarism and AI check complete.");
    } catch (checkError) {
      setError(checkError instanceof Error ? checkError.message : "Upload plagiarism and AI check failed.");
    } finally {
      setLoadingUploadFull(false);
    }
  }

  function applySpellingFix(issue: SpellingIssue) {
    if (!issue.word || !issue.suggestion) return;
    const escaped = issue.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "i");
    setContent((prev) => prev.replace(regex, issue.suggestion));
  }

  function applyTextFix(original: string, suggestion: string) {
    if (!original || !suggestion) return;
    setContent((prev) => prev.replace(original, suggestion));
  }

  function applyAllFixes() {
    if (!editorGrammarResult?.improvedVersion) return;
    setContent(editorGrammarResult.improvedVersion);
    setMessage("All fixes applied to editor.");
    setError(null);
  }

  async function checkGrammarRealTime(text: string) {
    if (!text.trim() || text.trim().length < 15) {
      setRealtimeMatches([]);
      return;
    }
    setRealtimeChecking(true);
    try {
      const params = new URLSearchParams({ language: "en-GB", text });
      const response = await fetch("https://api.languagetool.org/v2/check", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });
      const data = (await response.json()) as { matches?: RealtimeMatchRaw[] };
      const normalized: RealtimeMatch[] = (data.matches || []).map((m) => ({
        offset: m.offset,
        length: m.length,
        message: m.message,
        replacements: (m.replacements || []).slice(0, 3).map((r) => r.value || ""),
        ruleId: m.rule?.id || "",
        issueType:
          m.rule?.issueType === "misspelling"
            ? "spelling"
            : m.rule?.category?.id === "STYLE"
              ? "style"
              : "grammar",
      }));
      setRealtimeMatches(normalized);
      setExpandedRtMatchIdx(null);
    } catch {
      // silently ignore real-time check errors
    } finally {
      setRealtimeChecking(false);
    }
  }

  function handleContentChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const val = event.target.value;
    setContent(val);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      void checkGrammarRealTime(val);
    }, 1000);
  }

  function applyRealTimeFix(match: RealtimeMatch, replacement: string) {
    const before = content.slice(0, match.offset);
    const after = content.slice(match.offset + match.length);
    setContent(before + replacement + after);
    setRealtimeMatches((prev) => prev.filter((m) => m !== match));
    setExpandedRtMatchIdx(null);
  }

  async function copyCorrectedVersion() {
    const improved = uploadGrammarResult?.improvedVersion;
    if (!improved) return;
    try {
      await navigator.clipboard.writeText(improved);
      setMessage("Corrected version copied to clipboard.");
      setError(null);
    } catch {
      setError("Unable to copy corrected version.");
    }
  }

  async function downloadCorrectedVersion() {
    if (!savedFile || !uploadGrammarResult?.improvedVersion) return;
    setDownloadingCorrected(true);
    setError(null);
    setMessage(null);

    try {
      const ext = inferExt(savedFile.fileName);
      if (ext === "pdf") {
        const response = await fetch("/api/student/sop/download-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: `${typeLabel} Corrected Version`,
            typeLabel,
            content: uploadGrammarResult.improvedVersion,
          }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error || "Failed to generate corrected PDF.");
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const anchor = window.document.createElement("a");
        anchor.href = url;
        anchor.download = `${savedFile.fileName.replace(/\.[^.]+$/, "")}-corrected.pdf`;
        anchor.click();
        URL.revokeObjectURL(url);
      } else {
        const { Document, Packer, Paragraph, TextRun } = await import("docx");
        const lines = uploadGrammarResult.improvedVersion.split(/\n{2,}/).filter(Boolean);
        const doc = new Document({
          sections: [
            {
              children: lines.map((line) =>
                new Paragraph({
                  children: [new TextRun(line)],
                }),
              ),
            },
          ],
        });

        const blob = await Packer.toBlob(doc);
        const url = URL.createObjectURL(blob);
        const anchor = window.document.createElement("a");
        anchor.href = url;
        anchor.download = `${savedFile.fileName.replace(/\.[^.]+$/, "")}-corrected.docx`;
        anchor.click();
        URL.revokeObjectURL(url);
      }

      setMessage("Corrected version downloaded.");
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Failed to download corrected version.");
    } finally {
      setDownloadingCorrected(false);
    }
  }

  async function fetchSopDocStatus() {
    try {
      const res = await fetch("/api/student/sop/save-to-documents", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as { data?: { document?: { status?: string; uploadedAt?: string } | null } };
      const doc = json.data?.document;
      if (!doc) {
        setSopDocStatus("none");
        setSopDocSavedAt(null);
      } else if (doc.status === "VERIFIED") {
        setSopDocStatus("verified");
        setSopDocSavedAt(doc.uploadedAt || null);
        setSavedToDocuments(true);
      } else {
        setSopDocStatus("saved");
        setSopDocSavedAt(doc.uploadedAt || null);
        setSavedToDocuments(true);
      }
    } catch {
      // ignore
    }
  }

  async function downloadAsPdf() {
    if (!content.trim()) {
      setError("Please write some content before downloading.");
      return;
    }
    try {
      const res = await fetch("/api/student/sop/download-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: typeLabel, typeLabel, content }),
      });
      if (!res.ok) throw new Error("Failed to generate PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = docKind === "PERSONAL_STATEMENT" ? "Personal-Statement.pdf" : "Statement-of-Purpose.pdf";
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setMessage("PDF downloaded.");
      setError(null);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Failed to download PDF.");
    }
  }

  async function saveToDocuments(quiet = false) {
    if (!content.trim()) {
      if (!quiet) setError("Please write some content before saving to documents.");
      return;
    }
    setSavingToDocuments(true);
    if (!quiet) { setError(null); setMessage(null); }
    try {
      const res = await fetch("/api/student/sop/save-to-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, typeLabel, docKind }),
      });
      const json = (await res.json()) as { data?: { uploadedAt?: string }; error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to save to documents");
      setSopDocStatus("saved");
      setSopDocSavedAt(json.data?.uploadedAt || new Date().toISOString());
      setSavedToDocuments(true);
      if (!quiet) setMessage("SOP saved to your Documents successfully.");
    } catch (saveError) {
      if (!quiet) setError(saveError instanceof Error ? saveError.message : "Failed to save to documents.");
    } finally {
      setSavingToDocuments(false);
    }
  }

  async function saveUploadToDocuments(file: File) {
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/student/sop/upload-to-documents", {
        method: "POST",
        body: formData,
      });
      const json = (await res.json()) as { data?: { uploadedAt?: string }; error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to save to documents");
      setSopDocStatus("saved");
      setSopDocSavedAt(json.data?.uploadedAt || new Date().toISOString());
      setSavedToDocuments(true);
    } catch {
      // non-blocking: upload to documents is best-effort alongside local save
    }
  }

  useEffect(() => {
    loadDraft();
    loadUpload();
    loadVersionHistory();
    void fetchSopDocStatus();
    // Fetch studentId for QR upload
    void fetch("/api/student/profile", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        const sid = (json as { data?: { studentId?: string } })?.data?.studentId;
        if (sid) setStudentId(sid);
      })
      .catch(() => {
        // Ignore errors fetching student ID - QR upload optional
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen student-dashboard-bg">
      <main className="mx-auto w-full max-w-6xl p-4 md:p-8">
      <header className="mb-4 glass-card p-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Write SOP</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">Prepare your Statement of Purpose or Personal Statement.</p>
      </header>

      {view === "select" && (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <article className="glass-card p-6">
            <div className="w-fit rounded-lg bg-slate-100 p-2 text-slate-700"><Pencil className="h-5 w-5" /></div>
            <h2 className="mt-4 text-lg font-semibold text-slate-900">Write in Portal</h2>
            <p className="mt-1 text-sm text-slate-600">Write directly in the editor with grammar and authenticity checks.</p>
            <button type="button" onClick={() => setView("write")} className="mt-4 gradient-btn rounded-md px-4 py-2 text-sm font-semibold text-white">Start Writing</button>
          </article>

          <article className="glass-card p-6">
            <div className="w-fit rounded-lg bg-slate-100 p-2 text-slate-700"><Upload className="h-5 w-5" /></div>
            <h2 className="mt-4 text-lg font-semibold text-slate-900">Upload Your Document</h2>
            <p className="mt-1 text-sm text-slate-600">Upload PDF or Word and run grammar, plagiarism, and AI checks.</p>
            <button type="button" onClick={() => setView("upload")} className="mt-4 gradient-btn rounded-md px-4 py-2 text-sm font-semibold text-white">Upload Document</button>
          </article>
        </section>
      )}

      {view === "write" && (
        <section className="glass-card p-4 md:p-6">
          <button type="button" onClick={() => setView("select")} className="mb-4 inline-flex items-center gap-1 rounded-md border border-slate-300 dark:border-white/20 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200"><ArrowLeft className="h-4 w-4" /> Back</button>

          {/* SOP Documents Status Indicator */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {sopDocStatus === "none" && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                ⚠ Not yet saved to Documents — click Save to Documents to add it to your document list
              </span>
            )}
            {sopDocStatus === "saved" && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                ✓ Saved in Documents{sopDocSavedAt ? ` — ${formatDateTime(sopDocSavedAt)}` : ""}
              </span>
            )}
            {sopDocStatus === "verified" && (
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-300 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                ✓ Verified by counsellor{sopDocSavedAt ? ` — ${formatDateTime(sopDocSavedAt)}` : ""}
              </span>
            )}
          </div>

          <div className="mb-3 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 text-sm">
            <button type="button" onClick={() => setDocKind("SOP")} className={docKind === "SOP" ? "rounded-md bg-white px-3 py-1.5 font-semibold text-slate-900 shadow-sm" : "rounded-md px-3 py-1.5 text-slate-600"}>Statement of Purpose</button>
            <button type="button" onClick={() => setDocKind("PERSONAL_STATEMENT")} className={docKind === "PERSONAL_STATEMENT" ? "rounded-md bg-white px-3 py-1.5 font-semibold text-slate-900 shadow-sm" : "rounded-md px-3 py-1.5 text-slate-600"}>Personal Statement</button>
          </div>

          {/* Writing Prompts Panel */}
          <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
            <p className="mb-2 text-sm font-semibold text-blue-800">📋 Writing Guide — Cover all these sections for the best result:</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {WRITING_PROMPTS.map((prompt) => (
                <div key={prompt.heading} className="flex items-start gap-2 rounded-lg bg-white p-2.5 text-xs shadow-sm">
                  <span className="text-base leading-none">{prompt.icon}</span>
                  <div>
                    <span className="font-semibold text-slate-800">{prompt.heading}</span>
                    <span className="ml-1 text-slate-500">— {prompt.detail}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-amber-700">⚠️ Tip: Keep within 700 words for best impact.</p>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded bg-slate-100 px-2 py-1 text-slate-700">Word count: {wordCount}</span>
            {wordCount > 700 ? <span className="rounded bg-amber-100 px-2 py-1 text-amber-800">Recommended limit is 700 words</span> : null}
            {realtimeChecking && <span className="rounded bg-slate-100 px-2 py-1 text-slate-500">Checking grammar…</span>}
          </div>

          <textarea value={content} onChange={handleContentChange} className="mt-3 min-h-[460px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder={`Start writing your ${typeLabel} here...`} />

          {/* Real-Time Grammar Issues */}
          {realtimeMatches.length > 0 && (
            <div className="mt-2 rounded-lg border border-slate-200 bg-white p-3">
              <p className="mb-2 text-xs font-semibold text-slate-700">
                Real-time issues detected:{" "}
                {realtimeMatches.filter((m) => m.issueType === "spelling").length > 0 && (
                  <span className="mr-1 rounded-full bg-red-100 px-2 py-0.5 text-red-700">
                    {realtimeMatches.filter((m) => m.issueType === "spelling").length} spelling
                  </span>
                )}
                {realtimeMatches.filter((m) => m.issueType === "grammar").length > 0 && (
                  <span className="mr-1 rounded-full bg-blue-100 px-2 py-0.5 text-blue-700">
                    {realtimeMatches.filter((m) => m.issueType === "grammar").length} grammar
                  </span>
                )}
                {realtimeMatches.filter((m) => m.issueType === "style").length > 0 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">
                    {realtimeMatches.filter((m) => m.issueType === "style").length} style
                  </span>
                )}
              </p>
              <div className="space-y-1">
                {realtimeMatches.slice(0, 8).map((match, idx) => (
                  <div key={`rt-${idx}-${match.offset}`} className="rounded border border-slate-100 bg-slate-50 px-2 py-1.5 text-xs">
                    <div
                      className="flex cursor-pointer items-start justify-between gap-2"
                      onClick={() => setExpandedRtMatchIdx(expandedRtMatchIdx === idx ? null : idx)}
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${match.issueType === "spelling" ? "bg-red-400" : match.issueType === "grammar" ? "bg-blue-400" : "bg-amber-400"}`}
                        />
                        <span className="font-medium text-slate-700">
                          &quot;{content.slice(match.offset, match.offset + match.length)}&quot;
                        </span>
                        <span className="text-slate-500">— {match.message}</span>
                      </div>
                      <AlertCircle className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    </div>
                    {expandedRtMatchIdx === idx && match.replacements.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1 pl-4">
                        <span className="text-slate-500">Suggestions:</span>
                        {match.replacements.map((rep) => (
                          <button
                            key={rep}
                            type="button"
                            onClick={() => applyRealTimeFix(match, rep)}
                            className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-emerald-700 hover:bg-emerald-100"
                          >
                            {rep}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {realtimeMatches.length > 8 && (
                  <p className="pt-1 text-xs text-slate-500">+{realtimeMatches.length - 8} more issues — click Grammar Check for full analysis.</p>
                )}
              </div>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => void checkEditorGrammar()} disabled={loadingGrammar} className="relative inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60">
              <SpellCheck className="h-4 w-4" />
              {loadingGrammar ? "Checking..." : "Grammar Check"}
              {realtimeMatches.length > 0 && !loadingGrammar && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {realtimeMatches.length > 9 ? "9+" : realtimeMatches.length}
                </span>
              )}
            </button>
            <button type="button" onClick={() => void checkEditorFull()} disabled={loadingFullCheck} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"><ShieldCheck className="h-4 w-4" /> {loadingFullCheck ? "Checking..." : "Plagiarism and AI Detection Check"}</button>
            <button type="button" onClick={saveDraft} className="gradient-btn rounded-md px-3 py-2 text-sm font-semibold text-white">Save</button>
            <button
              type="button"
              onClick={() => void downloadAsPdf()}
              className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </button>
            <button
              type="button"
              onClick={() => void saveToDocuments()}
              disabled={savingToDocuments}
              className="inline-flex items-center gap-1 rounded-md bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
            >
              <FileText className="h-4 w-4" />
              {savingToDocuments ? "Saving…" : "Save to Documents"}
            </button>
            {savedToDocuments && !savingToDocuments && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                Saved to Documents ✓
              </span>
            )}
            <button type="button" onClick={() => setShowVersionHistory((prev) => !prev)} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">Version History</button>
            {editorGrammarResult?.improvedVersion && <button type="button" onClick={applyAllFixes} className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Apply All Fixes</button>}
          </div>

          {showVersionHistory && (
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              {versionHistory.length === 0 && <p>No saved versions yet.</p>}
              {versionHistory.length > 0 && (
                <ul className="space-y-1">
                  {versionHistory.map((item) => (
                    <li key={`${item.savedAt}-${item.docKind}`} className="flex items-center justify-between gap-2">
                      <span>{item.docKind === "SOP" ? "Statement of Purpose" : "Personal Statement"} saved on {formatDateTime(item.savedAt)}</span>
                      <button type="button" onClick={() => { setDocKind(item.docKind); setContent(item.content); }} className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700">Restore</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {editorGrammarResult && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Grammar Score</p>
              <p className={`text-4xl font-bold ${grammarScoreColor(editorGrammarResult.score)}`}>{editorGrammarResult.score}<span className="text-xl text-slate-500">/100</span></p>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="font-semibold text-slate-900">Spelling Errors</p>
                  <div className="mt-2 space-y-2 text-xs">
                    {editorGrammarResult.spellingErrors.length === 0 && <p className="text-slate-500">No spelling issues found.</p>}
                    {editorGrammarResult.spellingErrors.map((item, idx) => (
                      <div key={`${item.word}-${idx}`} className="rounded-md border border-slate-200 bg-white p-2">
                        <p><span className="font-semibold">Word:</span> {item.word || "-"}</p>
                        <p><span className="font-semibold">Suggestion:</span> {item.suggestion || "-"}</p>
                        <p><span className="font-semibold">Context:</span> {item.context || "-"}</p>
                        <button type="button" onClick={() => applySpellingFix(item)} className="mt-2 rounded border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700">Apply Fix</button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="font-semibold text-slate-900">Grammar Errors</p>
                  <div className="mt-2 space-y-2 text-xs">
                    {editorGrammarResult.grammarErrors.length === 0 && <p className="text-slate-500">No grammar issues found.</p>}
                    {editorGrammarResult.grammarErrors.map((item, idx) => (
                      <div key={`${item.original}-${idx}`} className="rounded-md border border-slate-200 bg-white p-2">
                        <p><span className="font-semibold">Original:</span> {item.original || "-"}</p>
                        <p><span className="font-semibold">Suggestion:</span> {item.suggestion || "-"}</p>
                        <p><span className="font-semibold">Explanation:</span> {item.explanation || "-"}</p>
                        <p><span className="font-semibold">Context:</span> {item.context || "-"}</p>
                        <button type="button" onClick={() => applyTextFix(item.original, item.suggestion)} className="mt-2 rounded border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700">Apply Fix</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <p className="font-semibold text-slate-900">Sentence Structure</p>
                <div className="mt-2 space-y-2 text-xs">
                  {editorGrammarResult.sentenceStructure.length === 0 && <p className="text-slate-500">No sentence-structure issues found.</p>}
                  {editorGrammarResult.sentenceStructure.map((item, idx) => (
                    <div key={`${item.original}-${idx}`} className="rounded-md border border-slate-200 bg-white p-2">
                      <p><span className="font-semibold">Issue:</span> {item.issue || "-"}</p>
                      <p><span className="font-semibold">Original:</span> {item.original || "-"}</p>
                      <p><span className="font-semibold">Suggestion:</span> {item.suggestion || "-"}</p>
                      <p><span className="font-semibold">Context:</span> {item.context || "-"}</p>
                      <button type="button" onClick={() => applyTextFix(item.original, item.suggestion)} className="mt-2 rounded border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700">Apply Fix</button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">Overall Feedback</p>
                <p className="mt-1">{editorGrammarResult.overallFeedback}</p>
              </div>
            </div>
          )}

          {editorFullResult && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="font-semibold text-slate-900">Plagiarism and AI Check</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className={`rounded px-2 py-1 font-semibold ${levelBadgeColor(editorFullResult.plagiarismLikelihood)}`}>Plagiarism: {editorFullResult.plagiarismLikelihood}</span>
                <span className={`rounded px-2 py-1 font-semibold ${levelBadgeColor(editorFullResult.aiLikelihood)}`}>AI Content: {editorFullResult.aiLikelihood}</span>
              </div>
              <p className="mt-2 text-xs text-slate-700">{editorFullResult.plagiarismReason}</p>
              <p className="mt-1 text-xs text-slate-700">{editorFullResult.aiReason}</p>

              <div className="mt-3 text-sm text-slate-700">Writing Quality: <span className="font-semibold">{editorFullResult.writingQuality}/10</span></div>
              <div className="mt-3 text-sm text-slate-700">Authenticity Score: <span className="font-semibold">{editorFullResult.authenticityScore}/100</span></div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded bg-slate-200"><div className="h-full bg-blue-600" style={{ width: `${editorFullResult.authenticityScore}%` }} /></div>

              <p className="mt-3 text-sm font-semibold text-slate-900">Suggestions</p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-slate-700">
                {editorFullResult.suggestions.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          )}
        </section>
      )}

      {view === "upload" && (
        <section className="glass-card p-4 md:p-6">
          <button type="button" onClick={() => setView("select")} className="mb-4 inline-flex items-center gap-1 rounded-md border border-slate-300 dark:border-white/20 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200"><ArrowLeft className="h-4 w-4" /> Back</button>

          <h2 className="text-xl font-semibold text-slate-900">Upload Your Document</h2>
          <p className="mt-1 text-sm text-slate-600">Upload your SOP or Personal Statement in PDF or Word format</p>

          <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
            <span className="text-sm font-medium text-slate-700">Drop a file or click to upload</span>
            <span className="mt-1 text-xs text-slate-500">Accepted formats: PDF, DOCX, DOC</span>
            <input type="file" className="hidden" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleUpload} />
          </label>
          {sopDocStatus !== "none" && (
            <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
              ⚠ Uploading a new file will replace your current SOP in the Documents section.
            </p>
          )}

          {studentId && (
            <button
              type="button"
              onClick={() => setShowSopQrModal(true)}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
            >
              📱 Take Photo with Phone via QR Code
            </button>
          )}

          {(pendingFile || savedFile) && (
            <div className="mt-4 rounded-lg border border-slate-200 p-3">
              <p className="text-sm font-semibold text-slate-900">{pendingFile?.name || savedFile?.fileName}</p>
              {savedFile && <p className="mt-1 text-xs text-slate-500">Uploaded: {formatDateTime(savedFile.savedAt)}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {pendingPreviewUrl ? (
                  <button type="button" onClick={() => window.open(pendingPreviewUrl, "_blank", "noopener,noreferrer")} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"><Eye className="h-3.5 w-3.5" /> Preview</button>
                ) : savedFile ? (
                  <button type="button" onClick={previewSavedUpload} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"><Eye className="h-3.5 w-3.5" /> Preview</button>
                ) : null}

                {pendingFile && <button type="button" onClick={() => void saveUpload()} className="gradient-btn rounded-md px-3 py-1.5 text-xs font-semibold text-white">Save</button>}
                {savedFile && <button type="button" onClick={downloadUpload} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"><Download className="h-3.5 w-3.5" /> Download</button>}
                <button type="button" onClick={deleteUpload} className="inline-flex items-center gap-1 rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
              </div>

              {savedFile && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => void checkUploadGrammar()} disabled={loadingUploadGrammar} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60"><SpellCheck className="h-3.5 w-3.5" /> {loadingUploadGrammar ? "Checking..." : "Check Grammar"}</button>
                  <button type="button" onClick={() => void checkUploadFull()} disabled={loadingUploadFull} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60"><ShieldCheck className="h-3.5 w-3.5" /> {loadingUploadFull ? "Checking..." : "Check Plagiarism and AI"}</button>
                </div>
              )}
            </div>
          )}

          {uploadGrammarResult && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Grammar Score</p>
              <p className={`text-4xl font-bold ${grammarScoreColor(uploadGrammarResult.score)}`}>{uploadGrammarResult.score}<span className="text-xl text-slate-500">/100</span></p>

              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => void copyCorrectedVersion()} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700">Copy Corrected Version</button>
                <button type="button" onClick={() => void downloadCorrectedVersion()} disabled={downloadingCorrected} className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">{downloadingCorrected ? "Preparing..." : "Download Corrected Version"}</button>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="font-semibold text-slate-900">Spelling Errors</p>
                  <ul className="mt-2 space-y-2 text-xs">
                    {uploadGrammarResult.spellingErrors.length === 0 && <li className="text-slate-500">No spelling issues found.</li>}
                    {uploadGrammarResult.spellingErrors.map((item, idx) => <li key={`${item.word}-${idx}`} className="rounded-md border border-slate-200 bg-white p-2"><p><span className="font-semibold">Word:</span> {item.word}</p><p><span className="font-semibold">Suggestion:</span> {item.suggestion}</p><p><span className="font-semibold">Context:</span> {item.context}</p></li>)}
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Grammar Errors</p>
                  <ul className="mt-2 space-y-2 text-xs">
                    {uploadGrammarResult.grammarErrors.length === 0 && <li className="text-slate-500">No grammar issues found.</li>}
                    {uploadGrammarResult.grammarErrors.map((item, idx) => <li key={`${item.original}-${idx}`} className="rounded-md border border-slate-200 bg-white p-2"><p><span className="font-semibold">Original:</span> {item.original}</p><p><span className="font-semibold">Suggestion:</span> {item.suggestion}</p><p><span className="font-semibold">Explanation:</span> {item.explanation}</p><p><span className="font-semibold">Context:</span> {item.context}</p></li>)}
                  </ul>
                </div>
              </div>

              <div className="mt-4">
                <p className="font-semibold text-slate-900">Sentence Structure</p>
                <ul className="mt-2 space-y-2 text-xs">
                  {uploadGrammarResult.sentenceStructure.length === 0 && <li className="text-slate-500">No sentence-structure issues found.</li>}
                  {uploadGrammarResult.sentenceStructure.map((item, idx) => <li key={`${item.original}-${idx}`} className="rounded-md border border-slate-200 bg-white p-2"><p><span className="font-semibold">Issue:</span> {item.issue}</p><p><span className="font-semibold">Original:</span> {item.original}</p><p><span className="font-semibold">Suggestion:</span> {item.suggestion}</p><p><span className="font-semibold">Context:</span> {item.context}</p></li>)}
                </ul>
              </div>

              <div className="mt-4 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">Overall Feedback</p>
                <p className="mt-1">{uploadGrammarResult.overallFeedback}</p>
              </div>
            </div>
          )}

          {uploadFullResult && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="font-semibold text-slate-900">Plagiarism and AI Check</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className={`rounded px-2 py-1 font-semibold ${levelBadgeColor(uploadFullResult.plagiarismLikelihood)}`}>Plagiarism: {uploadFullResult.plagiarismLikelihood}</span>
                <span className={`rounded px-2 py-1 font-semibold ${levelBadgeColor(uploadFullResult.aiLikelihood)}`}>AI Content: {uploadFullResult.aiLikelihood}</span>
              </div>
              <p className="mt-2 text-xs text-slate-700">{uploadFullResult.plagiarismReason}</p>
              <p className="mt-1 text-xs text-slate-700">{uploadFullResult.aiReason}</p>
              <div className="mt-3 text-sm text-slate-700">Writing Quality: <span className="font-semibold">{uploadFullResult.writingQuality}/10</span></div>
              <div className="mt-3 text-sm text-slate-700">Authenticity Score: <span className="font-semibold">{uploadFullResult.authenticityScore}/100</span></div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded bg-slate-200"><div className="h-full bg-blue-600" style={{ width: `${uploadFullResult.authenticityScore}%` }} /></div>
              <p className="mt-3 text-sm font-semibold text-slate-900">Suggestions</p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-slate-700">{uploadFullResult.suggestions.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          )}
        </section>
      )}

      {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {message && <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
      {savedDraftAt && <p className="mt-2 text-xs text-slate-500">Last saved draft: {formatDateTime(savedDraftAt)}</p>}
      {editorGrammarResult?.checkedAt && <p className="mt-1 text-xs text-slate-500">Last grammar check: {formatDateTime(editorGrammarResult.checkedAt)}</p>}

      {studentId && (
        <QRCodeUploadModal
          open={showSopQrModal}
          studentId={studentId}
          documentField="SOP"
          documentType="WRITTEN_DOCUMENT"
          documentLabel="SOP / Personal Statement"
          onClose={() => setShowSopQrModal(false)}
          onCompleted={async (payload) => {
            setShowSopQrModal(false);
            try {
              const res = await fetch(payload.fileUrl);
              const blob = await res.blob();
              const file = new File([blob], payload.fileName, { type: blob.type });
              const dt = new DataTransfer();
              dt.items.add(file);
              const fakeEvent = { target: { files: dt.files } } as unknown as React.ChangeEvent<HTMLInputElement>;
              handleUpload(fakeEvent);
            } catch {
              setError("Failed to load the uploaded file. Please try uploading directly.");
            }
          }}
        />
      )}
    </main>
    </div>
  );
}
