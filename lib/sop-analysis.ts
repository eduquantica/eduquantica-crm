import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { checkGrammar } from "@/lib/languagetool";

type AnalysisLevel = "Low" | "Medium" | "High";

export type SpellingIssue = {
  word: string;
  suggestion: string;
  context: string;
};

export type GrammarIssue = {
  original: string;
  suggestion: string;
  explanation: string;
  context: string;
};

export type SentenceStructureIssue = {
  issue: string;
  original: string;
  suggestion: string;
  context: string;
};

export type GrammarOnlyAnalysis = {
  score: number;
  spellingErrors: SpellingIssue[];
  grammarErrors: GrammarIssue[];
  sentenceStructure: SentenceStructureIssue[];
  improvedVersion: string;
  overallFeedback: string;
};

export type FullSopAnalysis = {
  plagiarismLikelihood: AnalysisLevel;
  plagiarismReason: string;
  aiLikelihood: AnalysisLevel;
  aiReason: string;
  writingQuality: number;
  suggestions: string[];
  authenticityScore: number;
};

function normalizeLevel(value: unknown): AnalysisLevel {
  const text = String(value || "").toLowerCase();
  if (text.includes("high")) return "High";
  if (text.includes("medium")) return "Medium";
  return "Low";
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeScore100(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(clamp(parsed, 0, 100));
}

function normalizeScore10(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.round(clamp(parsed, 1, 10) * 10) / 10;
}

function cleanDocBinaryText(input: Buffer): string {
  return input
    .toString("latin1")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, " ")
    .replace(/[^\x20-\x7E\n\r\t]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function inferFileNameFromUrl(fileUrl: string): string {
  if (fileUrl.startsWith("data:")) return "upload.bin";
  try {
    const url = new URL(fileUrl, "http://localhost");
    const pathName = url.pathname;
    const name = pathName.split("/").filter(Boolean).pop();
    return name || "upload.bin";
  } catch {
    return "upload.bin";
  }
}

function inferMimeFromFileName(fileName: string): string {
  const ext = (fileName.split(".").pop() || "").toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "doc") return "application/msword";
  if (ext === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return "application/octet-stream";
}

async function extractTextFromBuffer(args: {
  buffer: Buffer;
  fileName: string;
  mimeType?: string;
}): Promise<string> {
  const mime = args.mimeType || inferMimeFromFileName(args.fileName);
  const ext = (args.fileName.split(".").pop() || "").toLowerCase();

  if (ext === "docx" || mime.includes("wordprocessingml")) {
    const result = await mammoth.extractRawText({ buffer: args.buffer });
    return result.value.trim();
  }

  if (ext === "pdf" || mime.includes("pdf")) {
    const parser = new PDFParse({ data: args.buffer });
    const parsed = await parser.getText();
    await parser.destroy();
    return (parsed.text || "").trim();
  }

  if (ext === "doc" || mime.includes("msword")) {
    return cleanDocBinaryText(args.buffer);
  }

  throw new Error("Unsupported file format. Please upload PDF, DOCX, or DOC.");
}

function parseDataUrl(dataUrl: string): { buffer: Buffer; mimeType: string } {
  const [prefix, base64] = dataUrl.split(",");
  if (!prefix || !base64) {
    throw new Error("Invalid file payload.");
  }
  const mimeType = prefix.match(/data:(.*?);base64/)?.[1] ?? "application/octet-stream";
  return {
    buffer: Buffer.from(base64, "base64"),
    mimeType,
  };
}

export async function extractTextFromUploadedDocument(args: {
  dataUrl: string;
  fileName: string;
  mimeType?: string;
}): Promise<string> {
  const { buffer, mimeType } = parseDataUrl(args.dataUrl);
  return extractTextFromBuffer({
    buffer,
    fileName: args.fileName,
    mimeType: args.mimeType || mimeType,
  });
}

export async function extractTextFromFileUrl(fileUrl: string): Promise<string> {
  if (fileUrl.startsWith("data:")) {
    const fileName = inferFileNameFromUrl(fileUrl);
    const { buffer, mimeType } = parseDataUrl(fileUrl);
    return extractTextFromBuffer({ buffer, fileName, mimeType });
  }

  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch file for text extraction (${response.status}).`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const fileName = inferFileNameFromUrl(fileUrl);
  const mimeType = response.headers.get("content-type") || inferMimeFromFileName(fileName);

  return extractTextFromBuffer({
    buffer: Buffer.from(arrayBuffer),
    fileName,
    mimeType,
  });
}

async function callAnthropicForJson(prompt: string, maxTokens: number) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest",
      max_tokens: maxTokens,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) return null;
  const data = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
  const rawText = data.content?.find((item) => item.type === "text")?.text?.trim() || "";
  const jsonText = extractJsonObject(rawText);
  if (!jsonText) return null;

  try {
    return JSON.parse(jsonText) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function fallbackGrammarAnalysis(text: string): Promise<GrammarOnlyAnalysis> {
  return checkGrammar(text, "en-GB")
    .then((issues) => {
      const spelling = issues
        .filter((item) => item.category === "SPELLING")
        .slice(0, 8)
        .map((item) => ({
          word: text.slice(item.offset, item.offset + item.length) || "",
          suggestion: item.replacements[0] || "",
          context: item.message || "Potential spelling issue",
        }));

      const grammar = issues
        .filter((item) => item.category === "GRAMMAR" || item.category === "PUNCTUATION" || item.category === "STYLE")
        .slice(0, 8)
        .map((item) => ({
          original: text.slice(item.offset, item.offset + item.length) || "",
          suggestion: item.replacements[0] || "",
          explanation: item.message || "Potential grammar issue",
          context: item.shortMessage || item.message || "",
        }));

      const total = spelling.length + grammar.length;
      return {
        score: clamp(100 - total * 6, 0, 100),
        spellingErrors: spelling,
        grammarErrors: grammar,
        sentenceStructure: [],
        improvedVersion: text,
        overallFeedback: total > 0 ? "Your writing is understandable but needs grammar and spelling improvements." : "Your writing is grammatically strong.",
      };
    })
    .catch(() => ({
      score: 70,
      spellingErrors: [],
      grammarErrors: [],
      sentenceStructure: [],
      improvedVersion: text,
      overallFeedback: "Grammar service is temporarily unavailable.",
    }));
}

export async function runSopGrammarAnalysis(text: string): Promise<GrammarOnlyAnalysis> {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      score: 0,
      spellingErrors: [],
      grammarErrors: [],
      sentenceStructure: [],
      improvedVersion: "",
      overallFeedback: "No content provided.",
    };
  }

  const prompt = `You are a professional grammar and writing coach.
Analyse this text carefully and return ONLY a valid
JSON object with no markdown backticks:
{
  score: number 0-100,
  spellingErrors: [
    { word: string, suggestion: string, context: string }
  ],
  grammarErrors: [
    { original: string, suggestion: string,
      explanation: string, context: string }
  ],
  sentenceStructure: [
    { issue: string, original: string,
      suggestion: string, context: string }
  ],
  improvedVersion: string,
  overallFeedback: string
}

Text:
${trimmed}`;

  const parsed = await callAnthropicForJson(prompt, 2200);
  if (!parsed) {
    return fallbackGrammarAnalysis(trimmed);
  }

  return {
    score: normalizeScore100(parsed.score),
    spellingErrors: Array.isArray(parsed.spellingErrors)
      ? parsed.spellingErrors
          .map((item) => ({
            word: String((item as Record<string, unknown>).word || ""),
            suggestion: String((item as Record<string, unknown>).suggestion || ""),
            context: String((item as Record<string, unknown>).context || ""),
          }))
          .filter((item) => item.word || item.suggestion || item.context)
      : [],
    grammarErrors: Array.isArray(parsed.grammarErrors)
      ? parsed.grammarErrors
          .map((item) => ({
            original: String((item as Record<string, unknown>).original || ""),
            suggestion: String((item as Record<string, unknown>).suggestion || ""),
            explanation: String((item as Record<string, unknown>).explanation || ""),
            context: String((item as Record<string, unknown>).context || ""),
          }))
          .filter((item) => item.original || item.suggestion || item.explanation)
      : [],
    sentenceStructure: Array.isArray(parsed.sentenceStructure)
      ? parsed.sentenceStructure
          .map((item) => ({
            issue: String((item as Record<string, unknown>).issue || ""),
            original: String((item as Record<string, unknown>).original || ""),
            suggestion: String((item as Record<string, unknown>).suggestion || ""),
            context: String((item as Record<string, unknown>).context || ""),
          }))
          .filter((item) => item.issue || item.original || item.suggestion)
      : [],
    improvedVersion: String(parsed.improvedVersion || trimmed),
    overallFeedback: String(parsed.overallFeedback || "Good progress. Keep refining sentence clarity and grammar."),
  };
}

export async function runSopFullAnalysis(text: string): Promise<FullSopAnalysis> {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      plagiarismLikelihood: "Low",
      plagiarismReason: "No content provided.",
      aiLikelihood: "Low",
      aiReason: "No content provided.",
      writingQuality: 1,
      suggestions: ["Add content to analyse.", "Use specific personal experiences.", "Keep a clear paragraph structure."],
      authenticityScore: 0,
    };
  }

  const prompt = `Analyse this text and return ONLY a valid JSON object
with no markdown backticks:
{
  plagiarismLikelihood: 'Low' or 'Medium' or 'High',
  plagiarismReason: string,
  aiLikelihood: 'Low' or 'Medium' or 'High',
  aiReason: string,
  writingQuality: number 1-10,
  suggestions: [string, string, string],
  authenticityScore: number 0-100
}

Text:
${trimmed}`;

  const parsed = await callAnthropicForJson(prompt, 1600);
  if (!parsed) {
    return {
      plagiarismLikelihood: "Medium",
      plagiarismReason: "Automated plagiarism model unavailable. Please treat this as a preliminary estimate.",
      aiLikelihood: "Medium",
      aiReason: "Automated AI-content model unavailable. Please treat this as a preliminary estimate.",
      writingQuality: 6,
      suggestions: [
        "Add personal examples that are difficult to template.",
        "Use a more specific and evidence-based conclusion.",
        "Vary sentence openings to improve rhythm.",
      ],
      authenticityScore: 55,
    };
  }

  const suggestions = Array.isArray(parsed.suggestions)
    ? parsed.suggestions.map((item) => String(item)).filter(Boolean).slice(0, 3)
    : [];

  return {
    plagiarismLikelihood: normalizeLevel(parsed.plagiarismLikelihood),
    plagiarismReason: String(parsed.plagiarismReason || "No reason provided."),
    aiLikelihood: normalizeLevel(parsed.aiLikelihood),
    aiReason: String(parsed.aiReason || "No reason provided."),
    writingQuality: normalizeScore10(parsed.writingQuality),
    suggestions: suggestions.length > 0 ? suggestions : ["Add concrete examples.", "Improve paragraph transitions.", "Use more precise vocabulary."],
    authenticityScore: normalizeScore100(parsed.authenticityScore),
  };
}
