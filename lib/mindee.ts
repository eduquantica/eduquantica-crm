/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * OCR library — Claude vision is the primary engine.
 * Mindee SDK is kept as a placeholder for future re-integration if needed.
 */

// ─── Mindee placeholder (not called — kept for reference) ────────────────────
// const MINDEE_API_KEY = process.env.MINDEE_API_KEY || "";
// const MINDEE_API_URL = "https://api.mindee.net/v1/products";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const CLAUDE_MODEL = "claude-sonnet-4-6";
const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";

if (!ANTHROPIC_API_KEY) {
  console.warn("[OCR] ANTHROPIC_API_KEY not set — document scanning will fail.");
}

// ─── Public interfaces (unchanged — callers depend on these) ─────────────────

export interface PassportOCRData {
  mrz1: string;
  mrz2: string;
  surname: string;
  givenNames: string;
  dateOfBirth: string;
  expiryDate: string;
  nationality: string;
  documentNumber: string;
  confidence: number;
  source?: "mindee" | "anthropic";
}

export interface FinancialDocOCRData {
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  statementDate: string;
  closingBalance: number;
  openingBalance: number | null;
  currency: string;
  transactions: Array<{
    date: string;
    description: string;
    amount: number;
  }>;
  confidence: number;
}

export interface GenericDocOCRData {
  extractedText: string;
  confidence: number;
}

export interface MindeeErrorResponse {
  error: string;
  details?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeDateString(raw: string | null | undefined): string {
  const value = String(raw || "").trim();
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

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

async function fetchAsBase64(fileUrl: string): Promise<{ base64: string; mediaType: ClaudeMediaType }> {
  const res = await fetch(fileUrl);
  if (!res.ok) throw new Error(`Failed to fetch file: HTTP ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") || "";
  return { base64: bytes.toString("base64"), mediaType: inferMediaType(fileUrl, contentType) };
}

function buildDocumentContent(base64: string, mediaType: ClaudeMediaType): unknown {
  if (mediaType === "application/pdf") {
    return { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } };
  }
  return { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } };
}

async function callClaude(content: unknown[], maxTokens = 1024): Promise<string> {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

  const res = await fetch(CLAUDE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "pdfs-2024-09-25",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      messages: [{ role: "user", content }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Claude API error ${res.status}: ${body.slice(0, 200)}`);
  }

  const payload = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = payload.content?.find((c) => c.type === "text")?.text?.trim() || "";
  if (!text) throw new Error("Claude returned empty response");
  return text;
}

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch { /* fall through */ }
  }
  const arrStart = text.indexOf("[");
  const arrEnd = text.lastIndexOf("]");
  if (arrStart >= 0 && arrEnd > arrStart) {
    try { return JSON.parse(text.slice(arrStart, arrEnd + 1)); } catch { /* fall through */ }
  }
  throw new Error("No valid JSON found in Claude response");
}

// ─── Passport OCR ─────────────────────────────────────────────────────────────

/**
 * Scan a passport image/PDF using Claude vision and extract identity fields.
 * Mindee is kept as a commented-out placeholder below.
 */
export async function scanPassport(fileUrl: string): Promise<PassportOCRData | MindeeErrorResponse> {
  try {
    const { base64, mediaType } = await fetchAsBase64(fileUrl);
    const docContent = buildDocumentContent(base64, mediaType);

    const text = await callClaude([
      docContent,
      {
        type: "text",
        text: `Extract passport information from this document and return ONLY a JSON object with no markdown or explanation:
{
  "mrz1": "first MRZ line or empty string",
  "mrz2": "second MRZ line or empty string",
  "surname": "family name as printed",
  "givenNames": "all given/first names space-separated",
  "dateOfBirth": "YYYY-MM-DD or empty string",
  "expiryDate": "YYYY-MM-DD or empty string",
  "nationality": "3-letter ISO nationality code or country name",
  "documentNumber": "passport/document number",
  "confidence": 0.0 to 1.0 based on how clearly you can read the document
}
If a field is unreadable or not present set it to an empty string. Return only the JSON object.`,
      },
    ], 600);

    const parsed = extractJson(text) as {
      mrz1?: string;
      mrz2?: string;
      surname?: string;
      givenNames?: string;
      dateOfBirth?: string;
      expiryDate?: string;
      nationality?: string;
      documentNumber?: string;
      confidence?: number;
    };

    const surname = String(parsed.surname || "").trim();
    const givenNames = String(parsed.givenNames || "").trim();
    const documentNumber = String(parsed.documentNumber || "").trim();
    const dateOfBirth = normalizeDateString(parsed.dateOfBirth);
    const expiryDate = normalizeDateString(parsed.expiryDate);

    if (!surname && !givenNames && !documentNumber && !dateOfBirth && !expiryDate) {
      throw new Error("Claude could not extract any passport fields");
    }

    return {
      mrz1: String(parsed.mrz1 || "").trim(),
      mrz2: String(parsed.mrz2 || "").trim(),
      surname,
      givenNames,
      dateOfBirth,
      expiryDate,
      nationality: String(parsed.nationality || "").trim(),
      documentNumber,
      confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.8,
      source: "anthropic",
    };

    // ── Mindee placeholder ────────────────────────────────────────────────────
    // To re-enable Mindee, replace the block above with the implementation below:
    //
    // const blob = await (await fetch(fileUrl)).blob();
    // const formData = new FormData();
    // formData.append("document", blob, "passport.pdf");
    // const res = await fetch(`${MINDEE_API_URL}/mindee/passport/v1/predict`, {
    //   method: "POST",
    //   headers: { Authorization: `Token ${MINDEE_API_KEY}` },
    //   body: formData,
    // });
    // const result = await res.json();
    // const prediction = result.document?.inference?.prediction || {};
    // return { mrz1: prediction.mrz1?.raw_value || "", ... };
    // ─────────────────────────────────────────────────────────────────────────

  } catch (error) {
    console.error("[scanPassport] Claude OCR failed:", error);
    return { error: "Document uploaded. Please fill in your passport details manually above." };
  }
}

// ─── Financial Document OCR ───────────────────────────────────────────────────

/**
 * Scan a bank statement or financial document using Claude vision.
 * Mindee is kept as a commented-out placeholder below.
 */
export async function scanFinancialDoc(fileUrl: string): Promise<FinancialDocOCRData | MindeeErrorResponse> {
  try {
    const { base64, mediaType } = await fetchAsBase64(fileUrl);
    const docContent = buildDocumentContent(base64, mediaType);

    const text = await callClaude([
      docContent,
      {
        type: "text",
        text: `Extract bank/financial statement information from this document and return ONLY a JSON object with no markdown:
{
  "accountHolderName": "full name of account holder",
  "bankName": "name of the bank or financial institution",
  "accountNumber": "account number (partial is fine if full is not visible)",
  "statementDate": "YYYY-MM-DD statement end date or most recent date",
  "closingBalance": numeric closing/ending balance (number, no currency symbols),
  "openingBalance": numeric opening/starting balance or null if not shown,
  "currency": "3-letter ISO currency code e.g. GBP USD EUR",
  "transactions": [
    { "date": "YYYY-MM-DD", "description": "transaction description", "amount": numeric signed amount }
  ],
  "confidence": 0.0 to 1.0
}
Include up to 50 transactions. Use negative amounts for debits/withdrawals. Return only the JSON.`,
      },
    ], 2048);

    const parsed = extractJson(text) as {
      accountHolderName?: string;
      bankName?: string;
      accountNumber?: string;
      statementDate?: string;
      closingBalance?: unknown;
      openingBalance?: unknown;
      currency?: string;
      transactions?: Array<{ date?: string; description?: string; amount?: unknown }>;
      confidence?: number;
    };

    const closingBalance = parseFloat(String(parsed.closingBalance ?? "0")) || 0;
    const openingBalanceRaw = parsed.openingBalance != null ? parseFloat(String(parsed.openingBalance)) : null;
    const openingBalance = openingBalanceRaw !== null && isFinite(openingBalanceRaw) ? openingBalanceRaw : null;

    const transactions = (parsed.transactions || []).slice(0, 50).map((t) => ({
      date: normalizeDateString(String(t.date || "")),
      description: String(t.description || "").trim(),
      amount: parseFloat(String(t.amount ?? "0")) || 0,
    }));

    return {
      accountHolderName: String(parsed.accountHolderName || "").trim(),
      bankName: String(parsed.bankName || "").trim(),
      accountNumber: String(parsed.accountNumber || "").trim(),
      statementDate: normalizeDateString(parsed.statementDate),
      closingBalance,
      openingBalance,
      currency: String(parsed.currency || "GBP").trim().toUpperCase().slice(0, 3),
      transactions,
      confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.8,
    };

    // ── Mindee placeholder ────────────────────────────────────────────────────
    // const blob = await (await fetch(fileUrl)).blob();
    // const formData = new FormData();
    // formData.append("document", blob, "financial.pdf");
    // const res = await fetch(`${MINDEE_API_URL}/mindee/invoice/v4/predict`, {
    //   method: "POST",
    //   headers: { Authorization: `Token ${MINDEE_API_KEY}` },
    //   body: formData,
    // });
    // const result = await res.json();
    // const prediction = result.document?.inference?.prediction || {};
    // return { accountHolderName: prediction.customer_name?.value || "", ... };
    // ─────────────────────────────────────────────────────────────────────────

  } catch (error) {
    console.error("[scanFinancialDoc] Claude OCR failed:", error);
    return {
      error: `Financial document scan failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

// ─── Generic Document OCR ─────────────────────────────────────────────────────

/**
 * Extract all text from a document using Claude vision.
 * Mindee is kept as a commented-out placeholder below.
 */
export async function scanGenericDoc(fileUrl: string): Promise<GenericDocOCRData | MindeeErrorResponse> {
  try {
    const { base64, mediaType } = await fetchAsBase64(fileUrl);
    const docContent = buildDocumentContent(base64, mediaType);

    const text = await callClaude([
      docContent,
      {
        type: "text",
        text: "Extract and transcribe ALL visible text from this document exactly as it appears, preserving structure and layout. Return only the extracted text with no additional commentary.",
      },
    ], 2048);

    return {
      extractedText: text,
      confidence: 0.9,
    };

    // ── Mindee placeholder ────────────────────────────────────────────────────
    // const blob = await (await fetch(fileUrl)).blob();
    // const formData = new FormData();
    // formData.append("document", blob, "document.pdf");
    // const res = await fetch(`${MINDEE_API_URL}/mindee/document_type/v1/predict`, {
    //   method: "POST",
    //   headers: { Authorization: `Token ${MINDEE_API_KEY}` },
    //   body: formData,
    // });
    // const result = await res.json();
    // ...
    // ─────────────────────────────────────────────────────────────────────────

  } catch (error) {
    console.error("[scanGenericDoc] Claude OCR failed:", error);
    return {
      error: `Generic document scan failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
