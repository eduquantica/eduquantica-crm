import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { ChecklistService } from "@/lib/checklist";
import { triggerDocumentsSubmittedIfChecklistVerified } from "@/lib/application-status-triggers";

const schema = z.object({
  documentId: z.string().min(1),
});

function canApprove(role?: string) {
  return role === "ADMIN" || role === "MANAGER" || role === "COUNSELLOR";
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !canApprove(session.user.roleName)) {
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
        course: { select: { level: true } },
        university: { select: { country: true } },
      },
    });

    if (!application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const uploadedLogs = await db.activityLog.findMany({
      where: {
        entityType: "application",
        entityId: application.id,
        action: "bank_statement_uploaded",
      },
      orderBy: { createdAt: "desc" },
      select: { details: true },
    });

    const target = uploadedLogs
      .map((row) => {
        if (!row.details) return null;
        try {
          return JSON.parse(row.details) as {
            documentId: string;
            extracted?: unknown;
            checks?: unknown;
            outcome?: string;
            message?: string;
          };
        } catch {
          return null;
        }
      })
      .find((item) => item?.documentId === parsed.data.documentId);

    if (!target?.documentId) {
      return NextResponse.json({ error: "Uploaded bank statement not found" }, { status: 404 });
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

    const itemLabel = `Bank Statement (${target.outcome || "PENDING"})`;
    const existingItem = await db.checklistItem.findFirst({
      where: {
        checklistId: checklist.id,
        documentId: target.documentId,
      },
      select: { id: true },
    });

    const checklistItem = existingItem
      ? await db.checklistItem.update({
          where: { id: existingItem.id },
          data: {
            label: itemLabel,
            status: "VERIFIED",
            documentType: "FINANCIAL_PROOF",
            ocrStatus: "COMPLETED",
            ocrData: {
              extracted: target.extracted || null,
              checks: target.checks || null,
              outcome: target.outcome || null,
              message: target.message || null,
            },
            verifiedBy: session.user.id,
            verifiedAt: new Date(),
          },
          select: { id: true },
        })
      : await db.checklistItem.create({
          data: {
            checklistId: checklist.id,
            documentType: "FINANCIAL_PROOF",
            label: itemLabel,
            isRequired: true,
            documentId: target.documentId,
            status: "VERIFIED",
            ocrStatus: "COMPLETED",
            ocrData: {
              extracted: target.extracted || null,
              checks: target.checks || null,
              outcome: target.outcome || null,
              message: target.message || null,
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
        action: "bank_statement_approved",
        details: JSON.stringify({
          approvedAt: new Date().toISOString(),
          approvedBy: session.user.id,
          documentId: target.documentId,
          checklistItemId: checklistItem.id,
          outcome: target.outcome || null,
        }),
      },
    });

    await triggerDocumentsSubmittedIfChecklistVerified(application.id, session.user.id).catch(() => undefined);

    return NextResponse.json({
      data: {
        approved: true,
        checklistItemId: checklistItem.id,
        documentId: target.documentId,
      },
    });
  } catch (error) {
    console.error("[/api/dashboard/applications/[id]/finance/bank-statement/approve POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
