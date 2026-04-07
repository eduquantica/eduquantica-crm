import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { scanFinancialDoc, scanGenericDoc } from "@/lib/mindee";
import { detectCurrency, extractOfferFields } from "@/lib/application-finance";
import { saveToStudentDocument } from "@/lib/saveToStudentDocument";

const schema = z.object({
  fileName: z.string().min(1),
  fileUrl: z.string().min(1),
});

function canUpload(role?: string) {
  return role === "ADMIN" || role === "MANAGER" || role === "COUNSELLOR" || role === "SUB_AGENT";
}

type AnthropicOfferExtraction = {
  tuitionFee: number | null;
  currency: string | null;
  scholarshipAmount: number | null;
  depositRequired: number | null;
  courseStartDate: string | null;
};

function coerceNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").trim();
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function inferMediaType(fileUrl: string, contentType: string): string {
  if (contentType.includes("png")) return "image/png";
  if (contentType.includes("webp")) return "image/webp";
  if (contentType.includes("pdf")) return "application/pdf";
  const lower = fileUrl.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".pdf")) return "application/pdf";
  return "image/jpeg";
}

async function extractOfferWithAnthropic(fileUrl: string): Promise<AnthropicOfferExtraction | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const fileRes = await fetch(fileUrl, { cache: "no-store" });
  if (!fileRes.ok) return null;

  const contentType = fileRes.headers.get("content-type") || "";
  const mediaType = inferMediaType(fileUrl, contentType);
  const base64 = Buffer.from(await fileRes.arrayBuffer()).toString("base64");

  const fileBlock = mediaType === "application/pdf"
    ? {
        type: "document",
        source: {
          type: "base64",
          media_type: mediaType,
          data: base64,
        },
      }
    : {
        type: "image",
        source: {
          type: "base64",
          media_type: mediaType,
          data: base64,
        },
      };

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-opus-4-5",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: [
            fileBlock,
            {
              type: "text",
              text: "Extract finance fields from this offer letter and return ONLY valid JSON with no markdown in exactly this shape: {\"tuitionFee\": number or null, \"currency\": string or null, \"scholarshipAmount\": number or null, \"depositRequired\": number or null, \"courseStartDate\": string or null}. courseStartDate must be YYYY-MM-DD when known.",
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) return null;
  const payload = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = payload.content?.find((item) => item.type === "text")?.text || "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    return {
      tuitionFee: coerceNumber(parsed.tuitionFee),
      currency: typeof parsed.currency === "string" && parsed.currency.trim() ? parsed.currency.trim().toUpperCase() : null,
      scholarshipAmount: coerceNumber(parsed.scholarshipAmount),
      depositRequired: coerceNumber(parsed.depositRequired),
      courseStartDate: normalizeDate(parsed.courseStartDate),
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !canUpload(session.user.roleName)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }

    const application = await db.application.findUnique({
      where: { id: params.id },
      include: {
        course: {
          select: {
            tuitionFee: true,
          },
        },
        student: {
          include: {
            subAgent: { select: { userId: true } },
          },
        },
      },
    });

    if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 });

    if (session.user.roleName === "COUNSELLOR" && application.student.assignedCounsellorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (session.user.roleName === "SUB_AGENT" && application.student.subAgent?.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const savedDoc = await saveToStudentDocument(
      application.studentId,
      "OFFER_LETTER",
      parsed.data.fileUrl,
      parsed.data.fileName,
      session.user.id,
    );
    const document = { id: savedDoc.id };

    let extractedText = "";
    let confidence: number | null = null;
    let feeFromFinancial: number | null = null;

    const anthropicResult = await extractOfferWithAnthropic(parsed.data.fileUrl);

    if (!anthropicResult) {
      const financialOcr = await scanFinancialDoc(parsed.data.fileUrl);
      if ("error" in financialOcr) {
        const genericOcr = await scanGenericDoc(parsed.data.fileUrl);
        if ("error" in genericOcr) {
          extractedText = "";
          confidence = null;
        } else {
          extractedText = genericOcr.extractedText;
          confidence = genericOcr.confidence;
        }
      } else {
        extractedText = [financialOcr.bankName, financialOcr.accountHolderName, ...financialOcr.transactions.map((tx) => tx.description)].filter(Boolean).join("\n");
        confidence = financialOcr.confidence;
        feeFromFinancial = financialOcr.closingBalance || null;
      }
    }

    const parsedFields = extractOfferFields(extractedText || parsed.data.fileName);
    const extractedCourseFee = anthropicResult?.tuitionFee ?? parsedFields.courseFee ?? feeFromFinancial;
    const extractedCurrency = anthropicResult?.currency || parsedFields.currency || detectCurrency(extractedText) || null;
    const extractedScholarship = anthropicResult?.scholarshipAmount ?? parsedFields.scholarship;

    const ocr = {
      courseFee: extractedCourseFee,
      scholarship: extractedScholarship,
      currency: extractedCurrency,
      depositRequired: anthropicResult?.depositRequired ?? null,
      courseStartDate: anthropicResult?.courseStartDate ?? null,
      extractionStatus: anthropicResult ? "SUCCESS" as const : "FAILED" as const,
      extractionMessage: anthropicResult
        ? "Offer letter scanned. Figures pre-filled. Please verify before proceeding."
        : "Could not extract automatically. Please enter figures manually.",
      extractedText,
      confidence,
    };

    const prefillCourseFee = ocr.courseFee ?? application.course.tuitionFee ?? 0;
    const prefillScholarship = ocr.scholarship ?? 0;
    const prefillRemainingTuition = Math.max(prefillCourseFee - prefillScholarship, 0);

    await db.financeRecord.upsert({
      where: { applicationId: application.id },
      update: {
        courseFee: prefillCourseFee,
        courseFeeCurrency: ocr.currency || "GBP",
        scholarshipFinal: prefillScholarship,
        remainingTuition: prefillRemainingTuition,
      },
      create: {
        applicationId: application.id,
        selectedSources: [],
        courseFee: prefillCourseFee,
        courseFeeCurrency: ocr.currency || "GBP",
        scholarshipFinal: prefillScholarship,
        depositPaid: 0,
        remainingTuition: prefillRemainingTuition,
        livingExpenses: 0,
        durationMonths: 12,
        totalToShowInBank: prefillRemainingTuition,
      },
    });

    await db.application.update({
      where: { id: application.id },
      data: {
        offerReceivedAt: application.offerReceivedAt || new Date(),
      },
    });

    await db.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: "application",
        entityId: application.id,
        action: "offer_letter_uploaded",
        details: JSON.stringify({
          documentId: document.id,
          fileName: parsed.data.fileName,
          fileUrl: parsed.data.fileUrl,
          uploadedAt: new Date().toISOString(),
          ocr,
        }),
      },
    });

    return NextResponse.json({
      data: {
        documentId: document.id,
        ocr,
        autoExtracted: Boolean(anthropicResult),
        message: ocr.extractionMessage,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("[/api/dashboard/applications/[id]/finance/offer-letter POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
