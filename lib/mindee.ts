/* eslint-disable @typescript-eslint/no-explicit-any */

const MINDEE_API_KEY = process.env.MINDEE_API_KEY || "";
const MINDEE_API_URL = "https://api.mindee.net/v1/products";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

if (!MINDEE_API_KEY) {
  console.warn("Warning: MINDEE_API_KEY not configured. OCR will use Anthropic vision fallback.");
}

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

function normalizeDateString(raw: string | null | undefined): string {
  const value = String(raw || "").trim();
  if (!value) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function inferMediaType(fileUrl: string, contentType: string): string {
  if (contentType.includes("png")) return "image/png";
  if (contentType.includes("webp")) return "image/webp";
  if (contentType.includes("heic")) return "image/heic";
  if (contentType.includes("pdf")) return "application/pdf";

  const lower = fileUrl.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".heic")) return "image/heic";
  if (lower.endsWith(".pdf")) return "application/pdf";
  return "image/jpeg";
}

async function scanPassportWithAnthropic(fileUrl: string): Promise<PassportOCRData> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("Anthropic API key is not configured");
  }

  const fileResponse = await fetch(fileUrl);
  if (!fileResponse.ok) {
    throw new Error(`Failed to fetch file: HTTP ${fileResponse.status}`);
  }

  const bytes = Buffer.from(await fileResponse.arrayBuffer());
  const contentType = fileResponse.headers.get("content-type") || "";
  const mediaType = inferMediaType(fileUrl, contentType);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: bytes.toString("base64"),
              },
            },
            {
              type: "text",
              text: "Extract passport information from this image and return ONLY a JSON object with no markdown:\n{\n  passportNumber: string or null,\n  expiryDate: string in YYYY-MM-DD format or null,\n  firstName: string or null,\n  lastName: string or null,\n  nationality: string or null,\n  dateOfBirth: string in YYYY-MM-DD format or null\n}\nIf this is not a passport or you cannot read the information clearly, return null for each field.",
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic vision failed: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = payload.content?.find((item) => item.type === "text")?.text?.trim() || "";
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("Anthropic vision returned invalid JSON");
  }

  const parsed = JSON.parse(text.slice(start, end + 1)) as {
    passportNumber?: string | null;
    expiryDate?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    nationality?: string | null;
    dateOfBirth?: string | null;
  };

  const firstName = String(parsed.firstName || "").trim();
  const lastName = String(parsed.lastName || "").trim();
  const passportNumber = String(parsed.passportNumber || "").trim();
  const expiryDate = normalizeDateString(parsed.expiryDate);
  const dateOfBirth = normalizeDateString(parsed.dateOfBirth);
  const nationality = String(parsed.nationality || "").trim();

  if (!firstName && !lastName && !passportNumber && !expiryDate && !dateOfBirth && !nationality) {
    throw new Error("Anthropic could not extract passport fields");
  }

  return {
    mrz1: "",
    mrz2: "",
    surname: lastName,
    givenNames: firstName,
    dateOfBirth,
    expiryDate,
    nationality,
    documentNumber: passportNumber,
    confidence: 0.7,
    source: "anthropic",
  };
}

/**
 * Scan a document URL and extract passport information using Mindee
 */
export async function scanPassport(
  fileUrl: string,
): Promise<PassportOCRData | MindeeErrorResponse> {
  try {
    if (MINDEE_API_KEY) {
      try {
        const fileResponse = await fetch(fileUrl);
        if (!fileResponse.ok) {
          throw new Error(`Failed to fetch file: HTTP ${fileResponse.status}`);
        }
        const blob = await fileResponse.blob();

        const formData = new FormData();
        formData.append("document", blob, "passport.pdf");

        const response = await fetch(`${MINDEE_API_URL}/mindee/passport/v1/predict`, {
          method: "POST",
          headers: {
            "Authorization": `Token ${MINDEE_API_KEY}`,
          },
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Mindee API error: HTTP ${response.status}`);
        }

        const result = await response.json() as any;
        const document = result.document;

        if (!document) {
          throw new Error("Invalid response from Mindee API");
        }

        const prediction = document.inference?.prediction || {};
        const mrz1 = prediction.mrz1?.raw_value || "";
        const mrz2 = prediction.mrz2?.raw_value || "";
        const surname = prediction.surnames?.[0]?.value || "";
        const givenNames = prediction.given_names?.map((n: any) => n.value).join(" ") || "";
        const dateOfBirth = normalizeDateString(prediction.birth_date?.value || "");
        const expiryDate = normalizeDateString(prediction.expiry_date?.value || "");
        const nationality = prediction.nationality?.value || "";
        const documentNumber = prediction.document_number?.value || "";

        const confidenceValues = [
          prediction.surnames?.[0]?.confidence,
          prediction.given_names?.[0]?.confidence,
          prediction.birth_date?.confidence,
          prediction.expiry_date?.confidence,
          prediction.nationality?.confidence,
          prediction.document_number?.confidence,
        ].filter((c: any) => typeof c === "number");

        const confidence =
          confidenceValues.length > 0
            ? Math.round((confidenceValues.reduce((a: number, b: number) => a + b, 0) / confidenceValues.length) * 10000) / 10000
            : 0;

        return {
          mrz1,
          mrz2,
          surname,
          givenNames,
          dateOfBirth,
          expiryDate,
          nationality,
          documentNumber,
          confidence,
          source: "mindee",
        };
      } catch (mindeeError) {
        console.warn("Mindee passport OCR failed, trying Anthropic fallback:", mindeeError);
      }
    }

    const fallback = await scanPassportWithAnthropic(fileUrl);
    return fallback;
  } catch (error) {
    console.error("Passport OCR failed. Falling back to manual review:", error);
    return {
      error: "Document uploaded. Please fill in your passport details manually above.",
    };
  }
}

/**
 * Scan a financial document and extract bank/financial information using Mindee
 */
export async function scanFinancialDoc(
  fileUrl: string,
): Promise<FinancialDocOCRData | MindeeErrorResponse> {
  try {
    if (!MINDEE_API_KEY) {
      throw new Error("MINDEE_API_KEY is not configured");
    }

    // Fetch file from URL
    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) {
      throw new Error(`Failed to fetch file: HTTP ${fileResponse.status}`);
    }
    const blob = await fileResponse.blob();

    // Create FormData with file
    const formData = new FormData();
    formData.append("document", blob, "financial.pdf");

    // Send to Mindee API - using invoice parser as it can extract financial document data
    const response = await fetch(`${MINDEE_API_URL}/mindee/invoice/v4/predict`, {
      method: "POST",
      headers: {
        "Authorization": `Token ${MINDEE_API_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Mindee API error: HTTP ${response.status}`);
    }

    const result = await response.json() as any;
    const document = result.document;

    if (!document) {
      throw new Error("Invalid response from Mindee API");
    }

    const prediction = document.inference?.prediction || {};

    const accountHolderName = prediction.customer_name?.value || "";
    const bankName = prediction.supplier_name?.value || "";
    const accountNumber = prediction.receipt_number?.value || "";
    const statementDate = prediction.date?.value || "";
    const closingBalance = parseFloat(prediction.total_amount?.value || "0");
    const openingBalanceRaw =
      prediction.total_net?.value ||
      prediction.total_tax?.value ||
      prediction.total_base?.value ||
      null;
    const openingBalanceParsed = openingBalanceRaw != null ? parseFloat(String(openingBalanceRaw)) : null;
    const openingBalance = Number.isFinite(openingBalanceParsed || NaN) ? openingBalanceParsed : null;
    const currency = prediction.locale?.value?.split("-")[0]?.toUpperCase() || "GBP";

    // Extract line items as transactions
    const transactions = (prediction.line_items || [])
      .slice(0, 50)
      .map((item: any) => ({
        date: item.date?.value || "",
        description: item.description?.value || "",
        amount: parseFloat(item.total_amount?.value || item.unit_price?.value || "0"),
      }));

    // Calculate confidence from critical fields
    const confidenceValues = [
      prediction.customer_name?.confidence,
      prediction.supplier_name?.confidence,
      prediction.date?.confidence,
      prediction.total_amount?.confidence,
    ].filter((c: any) => typeof c === "number");

    const confidence =
      confidenceValues.length > 0
        ? Math.round(
            (confidenceValues.reduce((a: number, b: number) => a + b, 0) / confidenceValues.length) * 10000,
          ) / 10000
        : 0;

    return {
      accountHolderName,
      bankName,
      accountNumber,
      statementDate,
      closingBalance,
      openingBalance,
      currency,
      transactions,
      confidence,
    };
  } catch (error) {
    console.error("Mindee financial document scan failed:", error);
    return {
      error: `Financial document scan failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      details: error instanceof Error ? error.stack : undefined,
    };
  }
}

/**
 * Scan a generic document and extract text using Mindee
 */
export async function scanGenericDoc(
  fileUrl: string,
): Promise<GenericDocOCRData | MindeeErrorResponse> {
  try {
    if (!MINDEE_API_KEY) {
      throw new Error("MINDEE_API_KEY is not configured");
    }

    // Fetch file from URL
    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) {
      throw new Error(`Failed to fetch file: HTTP ${fileResponse.status}`);
    }
    const blob = await fileResponse.blob();

    // Create FormData with file
    const formData = new FormData();
    formData.append("document", blob, "document.pdf");

    // Send to Mindee API - using document type classifier
    const response = await fetch(`${MINDEE_API_URL}/mindee/document_type/v1/predict`, {
      method: "POST",
      headers: {
        "Authorization": `Token ${MINDEE_API_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Mindee API error: HTTP ${response.status}`);
    }

    const result = await response.json() as any;
    const document = result.document;

    if (!document) {
      throw new Error("Invalid response from Mindee API");
    }

    const prediction = document.inference?.prediction || {};

    // Get document type classification
    const documentType = prediction.document_type?.value || "Generic Document";
    const classificationConfidence = prediction.document_type?.confidence || 0.5;

    // Extract text from pages if available
    const pages = document.inference?.pages || [];
    let extractedText = "";

    for (const page of pages) {
      if (page.prediction?.text) {
        extractedText += page.prediction.text + "\n";
      } else if (page.raw_text) {
        extractedText += page.raw_text + "\n";
      }
    }

    return {
      extractedText: extractedText.trim() || `Document Type: ${documentType}`,
      confidence: Math.round(classificationConfidence * 10000) / 10000,
    };
  } catch (error) {
    console.error("Mindee generic document scan failed:", error);
    return {
      error: `Generic document scan failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      details: error instanceof Error ? error.stack : undefined,
    };
  }
}
