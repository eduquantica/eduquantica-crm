import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { readLatestAction } from "@/lib/application-finance";
import { ChecklistService } from "@/lib/checklist";
import { triggerDepositPaid, triggerDocumentsSubmittedIfChecklistVerified } from "@/lib/application-status-triggers";

function canApprove(role?: string) {
  return role === "ADMIN" || role === "MANAGER" || role === "COUNSELLOR";
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !canApprove(session.user.roleName)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const application = await db.application.findUnique({
      where: { id: params.id },
      include: {
        student: {
          include: {
            subAgent: { select: { userId: true } },
          },
        },
        course: { select: { level: true } },
        university: { select: { country: true } },
      },
    });

    if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 });

    const latestUpload = await readLatestAction<{
      documentId: string;
      ocr: {
        amountPaid: number | null;
        paymentDate: string | null;
        paymentReference: string | null;
      };
    }>(application.id, "deposit_receipt_uploaded");

    if (!latestUpload?.documentId) {
      return NextResponse.json({ error: "Deposit receipt must be uploaded before approval" }, { status: 400 });
    }

    const document = await db.document.findUnique({
      where: { id: latestUpload.documentId },
      select: { id: true, studentId: true, fileName: true },
    });

    if (!document || document.studentId !== application.studentId) {
      return NextResponse.json({ error: "Deposit receipt document not found" }, { status: 404 });
    }

    let checklist = await db.documentChecklist.findUnique({
      where: { applicationId: application.id },
      select: { id: true },
    });

    if (!checklist) {
      try {
        const generated = await ChecklistService.generateChecklist(application.id);
        checklist = { id: generated.id };
      } catch {
        const created = await db.documentChecklist.create({
          data: {
            applicationId: application.id,
            studentId: application.studentId,
            destinationCountry: application.university.country || null,
            courseLevel: String(application.course.level),
            status: "IN_PROGRESS",
          },
          select: { id: true },
        });
        checklist = created;
      }
    }

    const existingItem = await db.checklistItem.findFirst({
      where: {
        checklistId: checklist.id,
        label: "Deposit Receipt",
      },
      select: { id: true },
    });

    const checklistItem = existingItem
      ? await db.checklistItem.update({
          where: { id: existingItem.id },
          data: {
            documentId: document.id,
            status: "VERIFIED",
            ocrStatus: "COMPLETED",
            ocrData: {
              amountPaid: latestUpload.ocr?.amountPaid ?? null,
              paymentDate: latestUpload.ocr?.paymentDate ?? null,
              paymentReference: latestUpload.ocr?.paymentReference ?? null,
            },
            ocrConfidence: null,
            verifiedBy: session.user.id,
            verifiedAt: new Date(),
          },
          select: { id: true },
        })
      : await db.checklistItem.create({
          data: {
            checklistId: checklist.id,
            documentType: "FINANCIAL_PROOF",
            label: "Deposit Receipt",
            isRequired: true,
            documentId: document.id,
            status: "VERIFIED",
            ocrStatus: "COMPLETED",
            ocrData: {
              amountPaid: latestUpload.ocr?.amountPaid ?? null,
              paymentDate: latestUpload.ocr?.paymentDate ?? null,
              paymentReference: latestUpload.ocr?.paymentReference ?? null,
            },
            verifiedBy: session.user.id,
            verifiedAt: new Date(),
          },
          select: { id: true },
        });

    await db.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: "application",
        entityId: application.id,
        action: "deposit_receipt_approved",
        details: JSON.stringify({
          approvedAt: new Date().toISOString(),
          approvedBy: session.user.id,
          documentId: document.id,
          checklistItemId: checklistItem.id,
          amountPaid: latestUpload.ocr?.amountPaid ?? null,
        }),
      },
    });

    await triggerDepositPaid(application.id, session.user.id).catch(() => undefined);
    await triggerDocumentsSubmittedIfChecklistVerified(application.id, session.user.id).catch(() => undefined);

    return NextResponse.json({
      data: {
        approved: true,
        checklistItemId: checklistItem.id,
        amountPaid: latestUpload.ocr?.amountPaid ?? null,
      },
    });
  } catch (error) {
    console.error("[/api/dashboard/applications/[id]/finance/deposit-receipt/approve POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
