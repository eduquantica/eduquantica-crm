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

    const ocrResult = await scanFinancialDoc(parsed.data.fileUrl);
    const ocr = "error" in ocrResult
      ? {
          amountPaid: null,
          paymentDate: null,
          paymentReference: null,
          currency: null,
          confidence: null,
        }
      : {
          amountPaid: ocrResult.closingBalance || null,
          paymentDate: ocrResult.statementDate || null,
          paymentReference: ocrResult.accountNumber || null,
          currency: ocrResult.currency || null,
          confidence: ocrResult.confidence,
        };

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

    return NextResponse.json({ data: { documentId: document.id, ocr } }, { status: 201 });
  } catch (error) {
    console.error("[/api/dashboard/applications/[id]/finance/deposit-receipt POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
