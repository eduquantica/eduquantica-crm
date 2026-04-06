import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { scanFinancialDoc } from "@/lib/mindee";

const schema = z.object({
  fileName: z.string().min(1),
  fileUrl: z.string().min(1),
});

function canUpload(role?: string) {
  return role === "ADMIN"
    || role === "MANAGER"
    || role === "COUNSELLOR"
    || role === "SUB_AGENT"
    || role === "STUDENT"
    || role === "BRANCH_MANAGER"
    || role === "SUB_AGENT_COUNSELLOR";
}

type AnthropicDepositExtraction = {
  amountPaid: number | null;
  currency: string | null;
  paymentDate: string | null;
};

function coerceNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value.trim());
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

async function extractDepositWithAnthropic(fileUrl: string): Promise<AnthropicDepositExtraction | null> {
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
      max_tokens: 350,
      messages: [
        {
          role: "user",
          content: [
            fileBlock,
            {
              type: "text",
              text: "Extract deposit receipt values and return ONLY valid JSON with no markdown in exactly this shape: {\"amountPaid\": number or null, \"currency\": string or null, \"paymentDate\": string or null}. paymentDate must be YYYY-MM-DD when known.",
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
      amountPaid: coerceNumber(parsed.amountPaid),
      currency: typeof parsed.currency === "string" && parsed.currency.trim() ? parsed.currency.trim().toUpperCase() : null,
      paymentDate: normalizeDate(parsed.paymentDate),
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
        student: {
          select: {
            userId: true,
            assignedCounsellorId: true,
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

    if (session.user.roleName === "STUDENT" && application.student.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const document = await db.document.create({
      data: {
        studentId: application.studentId,
        applicationId: application.id,
        type: "FINANCIAL_PROOF",
        fileName: parsed.data.fileName,
        fileUrl: parsed.data.fileUrl,
        status: "PENDING",
      },
      select: { id: true },
    });

    const anthropicResult = await extractDepositWithAnthropic(parsed.data.fileUrl);
    const ocrResult = anthropicResult ? null : await scanFinancialDoc(parsed.data.fileUrl);
    const financialOcr = ocrResult && !("error" in ocrResult) ? ocrResult : null;
    const ocr = anthropicResult
      ? {
          amountPaid: anthropicResult.amountPaid,
          paymentDate: anthropicResult.paymentDate,
          paymentReference: null,
          currency: anthropicResult.currency,
          confidence: null,
        }
      : !financialOcr
        ? {
            amountPaid: null,
            paymentDate: null,
            paymentReference: null,
            currency: null,
            confidence: null,
          }
        : {
            amountPaid: financialOcr.closingBalance || null,
            paymentDate: financialOcr.statementDate || null,
            paymentReference: financialOcr.accountNumber || null,
            currency: financialOcr.currency || null,
            confidence: financialOcr.confidence,
          };

    const extractionMessage = anthropicResult
      ? null
      : "Could not extract automatically. Please enter figures manually.";

    await db.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: "application",
        entityId: application.id,
        action: "deposit_receipt_uploaded",
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
        message: extractionMessage,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("[/api/dashboard/applications/[id]/finance/deposit-receipt POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
