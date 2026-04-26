/**
 * Transcript OCR — Claude vision is the primary engine.
 * Mindee endpoints are kept as commented-out placeholders.
 */

import Fuse from "fuse.js";
import { SubjectCategory } from "@prisma/client";

export type TranscriptOcrRow = {
  subjectName: string;
  rawGrade: string;
  confidence: number;
};

export type SubjectMatchResult = {
  matchedName: string | null;
  subjectCategory: SubjectCategory;
  confidence: number;
  isMatched: boolean;
};

export type SubjectMasterEntry = {
  canonicalName: string;
  subjectCategory: SubjectCategory;
  aliases: string[];
};

type FuseSubjectRecord = {
  canonicalName: string;
  subjectCategory: SubjectCategory;
  alias: string;
};

// ── Mindee placeholders (not called — kept for reference) ────────────────────
// const MINDEE_API_KEY = process.env.MINDEE_API_KEY || "";
// const MINDEE_API_URL = "https://api.mindee.net/v1/products";
// const EDUCATION_MODEL_ENDPOINTS = [...];
// const TABLE_MODEL_ENDPOINTS    = [...];
// const GENERIC_MODEL_ENDPOINTS  = [...];
// ────────────────────────────────────────────────────────────────────────────

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const CLAUDE_MODEL = "claude-sonnet-4-6";

// ─── Subject master list ─────────────────────────────────────────────────────

export const SUBJECT_MASTER_LIST: SubjectMasterEntry[] = [
  { canonicalName: "Mathematics", subjectCategory: "STEM", aliases: ["Maths", "Math", "Additional Mathematics", "Further Maths", "Further Mathematics", "Ganit", "Hisab"] },
  { canonicalName: "English Language", subjectCategory: "LANGUAGE", aliases: ["English", "English Lit", "English Literature", "Bangla to English"] },
  { canonicalName: "Physics", subjectCategory: "STEM", aliases: ["Natural Science Physics", "Padarthovidya", "Padartha Biggan"] },
  { canonicalName: "Chemistry", subjectCategory: "STEM", aliases: ["Rasayan", "Science Chemistry", "Rasayan Biggan"] },
  { canonicalName: "Biology", subjectCategory: "STEM", aliases: ["Life Science", "Jibbigyan", "Jib Biggan"] },
  { canonicalName: "Economics", subjectCategory: "BUSINESS", aliases: ["Business Economics", "Arthaniti", "Orthoniti"] },
  { canonicalName: "Accounting", subjectCategory: "BUSINESS", aliases: ["Accounts", "Financial Accounting", "Hishab Biggan", "Principles of Accounts"] },
  { canonicalName: "Business Studies", subjectCategory: "BUSINESS", aliases: ["Commerce", "Business", "Business Organization"] },
  { canonicalName: "Computer Science", subjectCategory: "STEM", aliases: ["Computing", "ICT", "Information Technology", "CS"] },
  { canonicalName: "Information Technology", subjectCategory: "STEM", aliases: ["IT", "Applied ICT", "Digital Technology"] },
  { canonicalName: "Statistics", subjectCategory: "STEM", aliases: ["Stat", "Probability and Statistics"] },
  { canonicalName: "General Science", subjectCategory: "STEM", aliases: ["Science", "Integrated Science", "Combined Science"] },
  { canonicalName: "Geography", subjectCategory: "HUMANITIES", aliases: ["Human Geography", "Physical Geography"] },
  { canonicalName: "History", subjectCategory: "HUMANITIES", aliases: ["World History", "Modern History"] },
  { canonicalName: "Government", subjectCategory: "HUMANITIES", aliases: ["Civics", "Political Science Basics", "Social Studies Government"] },
  { canonicalName: "Civic Education", subjectCategory: "HUMANITIES", aliases: ["Civics", "Citizenship", "Citizenship Education"] },
  { canonicalName: "Social Studies", subjectCategory: "HUMANITIES", aliases: ["Social Science", "Society and Culture"] },
  { canonicalName: "Psychology", subjectCategory: "HUMANITIES", aliases: ["Intro Psychology", "Applied Psychology"] },
  { canonicalName: "Sociology", subjectCategory: "HUMANITIES", aliases: ["Social Sociology", "Socio Studies"] },
  { canonicalName: "Philosophy", subjectCategory: "HUMANITIES", aliases: ["Logic", "Ethics and Philosophy"] },
  { canonicalName: "Religious Studies", subjectCategory: "HUMANITIES", aliases: ["Islamic Studies", "Christian Religious Studies", "Hindu Religious Studies", "Moral Education"] },
  { canonicalName: "Bangla", subjectCategory: "LANGUAGE", aliases: ["Bengali", "Bangla Language", "Bangla First Paper", "Bangla Second Paper"] },
  { canonicalName: "Hindi", subjectCategory: "LANGUAGE", aliases: ["Hindi Language", "Hindi Literature"] },
  { canonicalName: "Urdu", subjectCategory: "LANGUAGE", aliases: ["Urdu Language", "Urdu Literature"] },
  { canonicalName: "French", subjectCategory: "LANGUAGE", aliases: ["French Language", "Français"] },
  { canonicalName: "Spanish", subjectCategory: "LANGUAGE", aliases: ["Spanish Language", "Español"] },
  { canonicalName: "Arabic", subjectCategory: "LANGUAGE", aliases: ["Arabic Language", "Modern Arabic"] },
  { canonicalName: "German", subjectCategory: "LANGUAGE", aliases: ["German Language", "Deutsch"] },
  { canonicalName: "Literature", subjectCategory: "LANGUAGE", aliases: ["English Literature", "World Literature", "Literature in English"] },
  { canonicalName: "Fine Arts", subjectCategory: "ARTS", aliases: ["Art", "Visual Arts", "Drawing", "Charukola"] },
  { canonicalName: "Music", subjectCategory: "ARTS", aliases: ["Music Theory", "Instrumental Music", "Vocal Music"] },
  { canonicalName: "Drama", subjectCategory: "ARTS", aliases: ["Theatre", "Performing Arts", "Stagecraft"] },
  { canonicalName: "Media Studies", subjectCategory: "ARTS", aliases: ["Mass Communication", "Film Studies", "Media"] },
  { canonicalName: "Graphic Design", subjectCategory: "ARTS", aliases: ["Design", "Visual Design"] },
  { canonicalName: "Physical Education", subjectCategory: "VOCATIONAL", aliases: ["PE", "Sports Science", "Health and Physical Education"] },
  { canonicalName: "Health Science", subjectCategory: "STEM", aliases: ["Health Studies", "Public Health", "Health and Social Care"] },
  { canonicalName: "Environmental Science", subjectCategory: "STEM", aliases: ["Environment", "Environmental Studies", "Ecology"] },
  { canonicalName: "Agricultural Science", subjectCategory: "VOCATIONAL", aliases: ["Agriculture", "Agri Science", "Krishi"] },
  { canonicalName: "Home Economics", subjectCategory: "VOCATIONAL", aliases: ["Domestic Science", "Food and Nutrition", "Griho Biggan"] },
  { canonicalName: "Food and Nutrition", subjectCategory: "VOCATIONAL", aliases: ["Nutrition", "Food Science", "Diet and Nutrition"] },
  { canonicalName: "Commerce", subjectCategory: "BUSINESS", aliases: ["Commercial Studies", "Business Commerce"] },
  { canonicalName: "Finance", subjectCategory: "BUSINESS", aliases: ["Business Finance", "Financial Management"] },
  { canonicalName: "Marketing", subjectCategory: "BUSINESS", aliases: ["Principles of Marketing", "Sales and Marketing"] },
  { canonicalName: "Management", subjectCategory: "BUSINESS", aliases: ["Business Management", "Principles of Management"] },
  { canonicalName: "Entrepreneurship", subjectCategory: "BUSINESS", aliases: ["Enterprise", "Entrepreneurial Studies"] },
  { canonicalName: "Law", subjectCategory: "HUMANITIES", aliases: ["Legal Studies", "Business Law", "Jurisprudence"] },
  { canonicalName: "Political Science", subjectCategory: "HUMANITIES", aliases: ["Politics", "Government and Politics"] },
  { canonicalName: "International Relations", subjectCategory: "HUMANITIES", aliases: ["Global Politics", "IR"] },
  { canonicalName: "Anthropology", subjectCategory: "HUMANITIES", aliases: ["Social Anthropology", "Cultural Anthropology"] },
  { canonicalName: "Marine Science", subjectCategory: "STEM", aliases: ["Oceanography", "Marine Studies"] },
  { canonicalName: "Earth Science", subjectCategory: "STEM", aliases: ["Geology", "Geoscience"] },
  { canonicalName: "Astronomy", subjectCategory: "STEM", aliases: ["Astrophysics Basics", "Space Science"] },
  { canonicalName: "Mechanics", subjectCategory: "STEM", aliases: ["Applied Mechanics", "Engineering Mechanics"] },
  { canonicalName: "Technical Drawing", subjectCategory: "VOCATIONAL", aliases: ["Engineering Drawing", "Drafting"] },
  { canonicalName: "Electrical Technology", subjectCategory: "VOCATIONAL", aliases: ["Electrical Installation", "Basic Electricity"] },
  { canonicalName: "Electronics", subjectCategory: "VOCATIONAL", aliases: ["Electronic Technology", "Electronics Systems"] },
  { canonicalName: "Woodwork", subjectCategory: "VOCATIONAL", aliases: ["Carpentry", "Wood Technology"] },
  { canonicalName: "Metalwork", subjectCategory: "VOCATIONAL", aliases: ["Metal Technology", "Fabrication"] },
  { canonicalName: "Auto Mechanics", subjectCategory: "VOCATIONAL", aliases: ["Automobile", "Motor Vehicle Mechanics"] },
  { canonicalName: "Textiles", subjectCategory: "VOCATIONAL", aliases: ["Textile Studies", "Garments"] },
  { canonicalName: "Tourism", subjectCategory: "VOCATIONAL", aliases: ["Travel and Tourism", "Hospitality and Tourism"] },
  { canonicalName: "Hospitality", subjectCategory: "VOCATIONAL", aliases: ["Hotel Management", "Hospitality Management"] },
  { canonicalName: "Banking", subjectCategory: "BUSINESS", aliases: ["Banking and Finance", "Financial Services"] },
  { canonicalName: "Book Keeping", subjectCategory: "BUSINESS", aliases: ["Bookkeeping", "Ledger Keeping"] },
  { canonicalName: "Data Processing", subjectCategory: "STEM", aliases: ["Data Management", "Data Handling"] },
  { canonicalName: "Core Mathematics", subjectCategory: "STEM", aliases: ["General Mathematics", "Math Core"] },
  { canonicalName: "Additional Mathematics", subjectCategory: "STEM", aliases: ["Add Maths", "Further Mathematics"] },
  { canonicalName: "Core English", subjectCategory: "LANGUAGE", aliases: ["English Core", "General English"] },
  { canonicalName: "Bangladesh and Global Studies", subjectCategory: "HUMANITIES", aliases: ["BGS", "Social and Global Studies"] },
];

// ─── Fuse.js subject matcher ─────────────────────────────────────────────────

const fuseRecords: FuseSubjectRecord[] = SUBJECT_MASTER_LIST.flatMap((subject) => [
  { canonicalName: subject.canonicalName, subjectCategory: subject.subjectCategory, alias: subject.canonicalName },
  ...subject.aliases.map((alias) => ({
    canonicalName: subject.canonicalName,
    subjectCategory: subject.subjectCategory,
    alias,
  })),
]);

const subjectFuse = new Fuse(fuseRecords, {
  keys: ["alias"],
  includeScore: true,
  threshold: 0.45,
  ignoreLocation: true,
  minMatchCharLength: 2,
});

export function matchSubjectName(rawSubjectName: string): SubjectMatchResult {
  const query = rawSubjectName.trim();
  if (!query) {
    return { matchedName: null, subjectCategory: "OTHER", confidence: 0, isMatched: false };
  }

  const direct = SUBJECT_MASTER_LIST.find((entry) => {
    const variants = [entry.canonicalName, ...entry.aliases].map((v) => v.toLowerCase());
    return variants.includes(query.toLowerCase());
  });

  if (direct) {
    return { matchedName: direct.canonicalName, subjectCategory: direct.subjectCategory, confidence: 1, isMatched: true };
  }

  const results = subjectFuse.search(query, { limit: 1 });
  if (!results.length) {
    return { matchedName: null, subjectCategory: "OTHER", confidence: 0, isMatched: false };
  }

  const top = results[0];
  const confidence = 1 - (top.score ?? 1);

  if (confidence < 0.7) {
    return { matchedName: null, subjectCategory: "OTHER", confidence, isMatched: false };
  }

  return { matchedName: top.item.canonicalName, subjectCategory: top.item.subjectCategory, confidence, isMatched: true };
}

// ─── Claude transcript scanner ───────────────────────────────────────────────

type ClaudeMediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif" | "application/pdf";

function inferMediaType(fileUrl: string, contentType: string): ClaudeMediaType {
  if (contentType.includes("png")) return "image/png";
  if (contentType.includes("webp")) return "image/webp";
  if (contentType.includes("gif")) return "image/gif";
  if (contentType.includes("pdf")) return "application/pdf";
  const lower = fileUrl.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".pdf")) return "application/pdf";
  return "image/jpeg";
}

function buildDocContent(base64: string, mediaType: ClaudeMediaType): unknown {
  if (mediaType === "application/pdf") {
    return { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } };
  }
  return { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } };
}

function dedupeRows(rows: TranscriptOcrRow[]): TranscriptOcrRow[] {
  const byKey = new Map<string, TranscriptOcrRow>();
  for (const row of rows) {
    const key = `${row.subjectName.toLowerCase()}::${row.rawGrade.toUpperCase()}`;
    const existing = byKey.get(key);
    if (!existing || row.confidence > existing.confidence) byKey.set(key, row);
  }
  return Array.from(byKey.values());
}

/**
 * Scan an academic transcript using Claude vision.
 * Returns an array of subject/grade rows extracted from the document.
 *
 * Mindee placeholder for re-integration:
 * // const blob = await fetchFileBlob(fileUrl);
 * // const payload = await submitToMindee(blob, endpoints);
 * // walkForRows(payload, rows);
 */
export async function scanTranscript(fileUrl: string, qualType: string): Promise<TranscriptOcrRow[]> {
  if (!ANTHROPIC_API_KEY) {
    console.error("[scanTranscript] ANTHROPIC_API_KEY not set");
    return [];
  }

  const res = await fetch(fileUrl);
  if (!res.ok) throw new Error(`Failed to fetch transcript file (${res.status})`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") || "";
  const mediaType = inferMediaType(fileUrl, contentType);
  const base64 = bytes.toString("base64");

  const qualHint = qualType ? ` This is a ${qualType} qualification transcript.` : "";

  const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "pdfs-2024-09-25",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            buildDocContent(base64, mediaType),
            {
              type: "text",
              text: `Extract all subject names and their grades/results from this academic transcript.${qualHint}
Return ONLY a JSON array with no markdown:
[
  { "subjectName": "exact subject name as printed", "rawGrade": "grade or result as printed e.g. A, B+, 85, Pass", "confidence": 0.0 to 1.0 },
  ...
]
Include every subject row you can see. If you cannot read a subject or grade clearly, use your best guess and set confidence below 0.6. Return only the JSON array.`,
            },
          ],
        },
      ],
    }),
  });

  if (!apiRes.ok) {
    const body = await apiRes.text().catch(() => "");
    throw new Error(`Claude transcript OCR failed: ${apiRes.status} ${body.slice(0, 200)}`);
  }

  const payload = (await apiRes.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = payload.content?.find((c) => c.type === "text")?.text?.trim() || "";

  const arrStart = text.indexOf("[");
  const arrEnd = text.lastIndexOf("]");
  if (arrStart < 0 || arrEnd <= arrStart) {
    console.warn("[scanTranscript] No JSON array in Claude response:", text.slice(0, 300));
    return [];
  }

  let parsed: Array<{ subjectName?: string; rawGrade?: string; confidence?: number }>;
  try {
    parsed = JSON.parse(text.slice(arrStart, arrEnd + 1));
  } catch {
    console.warn("[scanTranscript] Failed to parse Claude JSON array");
    return [];
  }

  const rows: TranscriptOcrRow[] = parsed
    .filter((r) => r.subjectName && r.rawGrade)
    .map((r) => ({
      subjectName: String(r.subjectName).trim(),
      rawGrade: String(r.rawGrade).trim(),
      confidence: typeof r.confidence === "number" ? Math.max(0, Math.min(1, r.confidence)) : 0.75,
    }));

  return dedupeRows(rows).filter((r) => r.subjectName && r.rawGrade);
}

export const SUBJECT_MASTER = SUBJECT_MASTER_LIST;
