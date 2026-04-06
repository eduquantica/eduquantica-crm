import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { finalizeChecklistIfComplete } from "@/lib/checklist-review";
import { triggerDocumentsSubmittedIfChecklistVerified } from "@/lib/application-status-triggers";
import { NotificationService } from "@/lib/notifications";

const ALLOWED_ROLES = new Set(["ADMIN", "MANAGER", "COUNSELLOR"]);
const LOCKABLE_TYPES = new Set(["SOP", "PERSONAL_STATEMENT"]);

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!ALLOWED_ROLES.has(session.user.roleName)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const document = await db.document.findUnique({
      where: { id: params.id },
      select: { id: true, studentId: true, type: true },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const lockScan = LOCKABLE_TYPES.has(document.type);

    const checklistIdsTouched = new Set<string>();

    await db.$transaction(async (tx) => {
      await tx.document.update({
        where: { id: document.id },
        data: { status: "VERIFIED" },
      });

      await tx.documentScanResult.upsert({
        where: { documentId: document.id },
        update: {
          counsellorDecision: "ACCEPTED",
          reviewedBy: session.user.id,
          reviewedAt: new Date(),
          isLocked: lockScan,
        },
        create: {
          documentId: document.id,
          status: "PENDING",
          counsellorDecision: "ACCEPTED",
          reviewedBy: session.user.id,
          reviewedAt: new Date(),
          isLocked: lockScan,
        },
      });

      await tx.activityLog.create({
        data: {
          userId: session.user.id,
          entityType: "document",
          entityId: document.id,
          action: lockScan ? "document_approved_and_scan_locked" : "document_approved",
          details: `Document ${document.type} approved for student ${document.studentId}`,
        },
      });

      const linkedItems = await tx.checklistItem.findMany({
        where: { documentId: document.id },
        select: { id: true, checklistId: true },
      });

      for (const item of linkedItems) {
        checklistIdsTouched.add(item.checklistId);
        await tx.checklistItem.update({
          where: { id: item.id },
          data: {
            status: "VERIFIED",
            counsellorNote: null,
            verifiedBy: session.user.id,
            verifiedAt: new Date(),
          },
        });

        await finalizeChecklistIfComplete(tx, item.checklistId, session.user.id);
      }
    });

    if (checklistIdsTouched.size > 0) {
      const checklists = await db.documentChecklist.findMany({
        where: { id: { in: Array.from(checklistIdsTouched) } },
        select: { applicationId: true },
      });

      await Promise.all(
        checklists
          .map((item) => item.applicationId)
          .filter((id): id is string => Boolean(id))
          .map((applicationId) => triggerDocumentsSubmittedIfChecklistVerified(applicationId, session.user.id).catch(() => undefined)),
      );
    }

    if (document.type === "PASSPORT") {
      const student = await db.student.findUnique({
        where: { id: document.studentId },
        select: { userId: true },
      });

      if (student?.userId) {
        await NotificationService.createNotification({
          userId: student.userId,
          type: "DOCUMENT_VERIFIED",
          message: "Your passport has been verified.",
          linkUrl: "/student/documents",
          actorUserId: session.user.id,
        }).catch(() => undefined);
      }
    }

    return NextResponse.json({
      data: {
        documentId: document.id,
        approved: true,
        scanLocked: lockScan,
      },
    });
  } catch (error) {
    console.error("[/api/admin/documents/[id]/approve POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
