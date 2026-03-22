import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { scanFinancialDoc, scanGenericDoc } from "@/lib/mindee";
import { detectCurrency, extractOfferFields } from "@/lib/application-finance";

const schema = z.object({
  fileName: z.string().min(1),
  fileUrl: z.string().min(1),
});

function canUpload(role?: string) {
  return role === "ADMIN" || role === "MANAGER" || role === "COUNSELLOR" || role === "SUB_AGENT";
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

    const document = await db.document.create({
      data: {
        studentId: application.studentId,
        applicationId: application.id,
        type: "OTHER",
        fileName: parsed.data.fileName,
        fileUrl: parsed.data.fileUrl,
        status: "PENDING",
      },
      select: { id: true },
    });

    const financialOcr = await scanFinancialDoc(parsed.data.fileUrl);
    let extractedText = "";
    let confidence: number | null = null;
    let feeFromFinancial: number | null = null;

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

    const parsedFields = extractOfferFields(extractedText || parsed.data.fileName);

    const ocr = {
      courseFee: parsedFields.courseFee ?? feeFromFinancial,
      scholarship: parsedFields.scholarship,
      currency: parsedFields.currency || detectCurrency(extractedText) || null,
      extractedText,
      confidence,
    };

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

    return NextResponse.json({ data: { documentId: document.id, ocr } }, { status: 201 });
  } catch (error) {
    console.error("[/api/dashboard/applications/[id]/finance/offer-letter POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
