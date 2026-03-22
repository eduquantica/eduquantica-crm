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

const MINDEE_API_KEY = process.env.MINDEE_API_KEY || "";
const MINDEE_API_URL = "https://api.mindee.net/v1/products";

const EDUCATION_MODEL_ENDPOINTS = [
  `${MINDEE_API_URL}/mindee/education/v1/predict`,
  `${MINDEE_API_URL}/mindee/transcript/v1/predict`,
  `${MINDEE_API_URL}/mindee/report_card/v1/predict`,
];

const TABLE_MODEL_ENDPOINTS = [
  `${MINDEE_API_URL}/mindee/table_recognition/v1/predict`,
  `${MINDEE_API_URL}/mindee/invoice/v4/predict`,
];

const GENERIC_MODEL_ENDPOINTS = [
  `${MINDEE_API_URL}/mindee/document_type/v1/predict`,
  `${MINDEE_API_URL}/mindee/invoice/v4/predict`,
];

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

function mapQualType(input: string): "EDUCATION" | "TABLE" | "GENERIC" {
  const q = input.trim().toUpperCase();

  if (q === "WAEC" || q === "GCSE" || q === "A_LEVEL" || q === "O_LEVEL" || q === "GCSE_ALEVEL") {
    return "EDUCATION";
  }

  if (q === "SSC" || q === "HSC" || q === "SSC_HSC") {
    return "TABLE";
  }

  return "GENERIC";
}

async function fetchFileBlob(fileUrl: string): Promise<Blob> {
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch transcript file (${response.status})`);
  }
  return response.blob();
}

async function submitToMindee(blob: Blob, endpoints: string[]): Promise<Record<string, unknown>> {
  if (!MINDEE_API_KEY) {
    throw new Error("MINDEE_API_KEY is not configured");
  }

  let lastError = "";

  for (const endpoint of endpoints) {
    const formData = new FormData();
    formData.append("document", blob, "transcript.pdf");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Token ${MINDEE_API_KEY}`,
        },
        body: formData,
      });

      if (!response.ok) {
        lastError = `Mindee ${endpoint} failed (${response.status})`;
        continue;
      }

      return (await response.json()) as Record<string, unknown>;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unknown Mindee request error";
    }
  }

  throw new Error(lastError || "Mindee request failed");
}

function walkForRows(node: unknown, rows: TranscriptOcrRow[]): void {
  if (!node) return;

  if (Array.isArray(node)) {
    node.forEach((item) => walkForRows(item, rows));
    return;
  }

  if (typeof node !== "object") return;

  const record = node as Record<string, unknown>;

  const subjectCandidate =
    record.subject ||
    record.subject_name ||
    record.course ||
    record.course_name ||
    record.paper ||
    record.name ||
    null;

  const gradeCandidate =
    record.grade ||
    record.result ||
    record.mark ||
    record.score ||
    record.value ||
    null;

  const confidenceCandidate =
    record.confidence ||
    record.probability ||
    record.reliability ||
    null;

  if (typeof subjectCandidate === "string" && typeof gradeCandidate === "string") {
    const confidence = typeof confidenceCandidate === "number" ? confidenceCandidate : 0.75;
    rows.push({
      subjectName: subjectCandidate.trim(),
      rawGrade: gradeCandidate.trim(),
      confidence: Math.max(0, Math.min(1, confidence)),
    });
  }

  Object.values(record).forEach((child) => walkForRows(child, rows));
}

function parseGenericTextRows(text: string): TranscriptOcrRow[] {
  const lines = text
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean);

  const rows: TranscriptOcrRow[] = [];

  for (const line of lines) {
    const match = line.match(/^([A-Za-z0-9().,\-\s/&]+?)\s+([A-F][*]?|[A-F][1-9]?|[BCDE]\d|\d+(?:\.\d+)?%?)$/i);
    if (!match) continue;

    rows.push({
      subjectName: match[1].trim(),
      rawGrade: match[2].trim(),
      confidence: 0.65,
    });
  }

  return rows;
}

function dedupeRows(rows: TranscriptOcrRow[]): TranscriptOcrRow[] {
  const byKey = new Map<string, TranscriptOcrRow>();

  for (const row of rows) {
    const key = `${row.subjectName.toLowerCase()}::${row.rawGrade.toUpperCase()}`;
    const existing = byKey.get(key);
    if (!existing || row.confidence > existing.confidence) {
      byKey.set(key, row);
    }
  }

  return Array.from(byKey.values());
}

export function matchSubjectName(rawSubjectName: string): SubjectMatchResult {
  const query = rawSubjectName.trim();
  if (!query) {
    return {
      matchedName: null,
      subjectCategory: "OTHER",
      confidence: 0,
      isMatched: false,
    };
  }

  const direct = SUBJECT_MASTER_LIST.find((entry) => {
    const variants = [entry.canonicalName, ...entry.aliases].map((v) => v.toLowerCase());
    return variants.includes(query.toLowerCase());
  });

  if (direct) {
    return {
      matchedName: direct.canonicalName,
      subjectCategory: direct.subjectCategory,
      confidence: 1,
      isMatched: true,
    };
  }

  const results = subjectFuse.search(query, { limit: 1 });
  if (!results.length) {
    return {
      matchedName: null,
      subjectCategory: "OTHER",
      confidence: 0,
      isMatched: false,
    };
  }

  const top = results[0];
  const confidence = 1 - (top.score ?? 1);

  if (confidence < 0.7) {
    return {
      matchedName: null,
      subjectCategory: "OTHER",
      confidence,
      isMatched: false,
    };
  }

  return {
    matchedName: top.item.canonicalName,
    subjectCategory: top.item.subjectCategory,
    confidence,
    isMatched: true,
  };
}

export async function scanTranscript(fileUrl: string, qualType: string): Promise<TranscriptOcrRow[]> {
  const route = mapQualType(qualType);
  const blob = await fetchFileBlob(fileUrl);

  const endpoints =
    route === "EDUCATION"
      ? EDUCATION_MODEL_ENDPOINTS
      : route === "TABLE"
        ? TABLE_MODEL_ENDPOINTS
        : GENERIC_MODEL_ENDPOINTS;

  const payload = await submitToMindee(blob, endpoints);

  const rows: TranscriptOcrRow[] = [];
  walkForRows(payload, rows);

  if (!rows.length) {
    const rawText = JSON.stringify(payload);
    rows.push(...parseGenericTextRows(rawText));
  }

  return dedupeRows(rows).filter((row) => row.subjectName && row.rawGrade);
}

export const SUBJECT_MASTER = SUBJECT_MASTER_LIST;
