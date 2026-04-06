import { db } from "@/lib/db";

export type OfferLetterExtracted = {
  courseFee: number | null;
  scholarship: number | null;
  currency: string | null;
  depositRequired: number | null;
  courseStartDate: string | null;
  extractionStatus?: "SUCCESS" | "FAILED";
  extractionMessage?: string;
  extractedText: string;
  confidence: number | null;
};

export type DepositExtracted = {
  amountPaid: number | null;
  paymentDate: string | null;
  paymentReference: string | null;
  currency: string | null;
  confidence: number | null;
};

export function pickFirstAmount(text: string): number | null {
  const clean = text.replace(/,/g, "");
  const match = clean.match(/(?:GBP|USD|CAD|AUD|EUR|£|\$)?\s*(\d{3,}(?:\.\d{1,2})?)/i);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function detectCurrency(text: string): string | null {
  const upper = text.toUpperCase();
  if (upper.includes("GBP") || text.includes("£")) return "GBP";
  if (upper.includes("CAD")) return "CAD";
  if (upper.includes("AUD")) return "AUD";
  if (upper.includes("EUR") || text.includes("€")) return "EUR";
  if (upper.includes("USD") || text.includes("$")) return "USD";
  return null;
}

export function extractOfferFields(extractedText: string) {
  const feeMatch = extractedText.match(/(?:tuition|course\s+fee|total\s+fee)[^\d]{0,20}(\d{3,}(?:[.,]\d{1,2})?)/i);
  const scholarshipMatch = extractedText.match(/(?:scholarship|discount|bursary)[^\d]{0,20}(\d{2,}(?:[.,]\d{1,2})?)/i);

  const courseFee = feeMatch ? Number(feeMatch[1].replace(/,/g, "")) : pickFirstAmount(extractedText);
  const scholarship = scholarshipMatch ? Number(scholarshipMatch[1].replace(/,/g, "")) : null;
  const currency = detectCurrency(extractedText);

  return {
    courseFee: Number.isFinite(courseFee || NaN) ? (courseFee as number) : null,
    scholarship: Number.isFinite(scholarship || NaN) ? (scholarship as number) : null,
    currency,
  };
}

export async function readLatestAction<T>(applicationId: string, action: string): Promise<T | null> {
  const log = await db.activityLog.findFirst({
    where: {
      entityType: "application",
      entityId: applicationId,
      action,
    },
    orderBy: { createdAt: "desc" },
    select: { details: true },
  });

  if (!log?.details) return null;

  try {
    return JSON.parse(log.details) as T;
  } catch {
    return null;
  }
}
