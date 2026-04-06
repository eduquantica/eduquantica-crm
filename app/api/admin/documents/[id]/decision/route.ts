import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { finalizeChecklistIfComplete } from "@/lib/checklist-review";
import { NotificationService } from "@/lib/notifications";

const ALLOWED_ROLES = new Set(["ADMIN", "MANAGER", "COUNSELLOR"]);
const LOCKABLE_TYPES = new Set(["SOP", "PERSONAL_STATEMENT"]);

const bodySchema = z.object({
  decision: z.enum(["ACCEPTED", "REVISION_REQUIRED", "REJECTED"]),
  note: z.string().trim().optional(),
});

export async function POST(
  request: NextRequest,
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

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }

    const note = parsed.data.note?.trim() || null;
    if ((parsed.data.decision === "REVISION_REQUIRED" || parsed.data.decision === "REJECTED") && !note) {
      return NextResponse.json({ error: "A note/reason is required for this decision" }, { status: 400 });
    }

    const document = await db.document.findUnique({
      where: { id: params.id },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            userId: true,
            assignedCounsellorId: true,
          },
        },
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (
      session.user.roleName === "COUNSELLOR" &&
      document.student.assignedCounsellorId !== session.user.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const lockScan = parsed.data.decision === "ACCEPTED" && LOCKABLE_TYPES.has(document.type);
    const documentStatus = parsed.data.decision === "ACCEPTED" ? "VERIFIED" : parsed.data.decision === "REJECTED" ? "REJECTED" : "PENDING";
    const scanUpdateData: {
      counsellorDecision: "ACCEPTED" | "REVISION_REQUIRED" | "REJECTED";
      counsellorNote: string | null;
      reviewedBy: string;
      reviewedAt: Date;
      isLocked?: boolean;
    } = {
      counsellorDecision: parsed.data.decision,
      counsellorNote: note,
      reviewedBy: session.user.id,
      reviewedAt: new Date(),
    };
    if (lockScan) {
      scanUpdateData.isLocked = true;
    }

    const updated = await db.$transaction(async (tx) => {
      await tx.document.update({
        where: { id: document.id },
        data: { status: documentStatus },
      });

      const scan = await tx.documentScanResult.upsert({
        where: { documentId: document.id },
        update: scanUpdateData,
        create: {
          documentId: document.id,
          status: "PENDING",
          counsellorDecision: parsed.data.decision,
          counsellorNote: note,
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
          action: "document_scan_decision",
          details: `Decision ${parsed.data.decision} on ${document.type}. Note: ${note || "N/A"}`,
        },
      });

      // Keep activity trail for revision/rejection outcomes.
      if (parsed.data.decision === "REVISION_REQUIRED" || parsed.data.decision === "REJECTED") {
        await tx.activityLog.create({
          data: {
            userId: document.student.userId,
            entityType: "document",
            entityId: document.id,
            action: parsed.data.decision === "REJECTED" ? "document_rejected" : "document_revision_requested",
            details: note || "Your document was reviewed.",
          },
        });
      }

      const linkedItems = await tx.checklistItem.findMany({
        where: { documentId: document.id },
        select: { id: true, checklistId: true },
      });

      for (const item of linkedItems) {
        await tx.checklistItem.update({
          where: { id: item.id },
          data: {
            status: parsed.data.decision === "ACCEPTED" ? "VERIFIED" : "REJECTED",
            counsellorNote: note,
            verifiedBy: parsed.data.decision === "ACCEPTED" ? session.user.id : null,
            verifiedAt: parsed.data.decision === "ACCEPTED" ? new Date() : null,
          },
        });

        if (document.student.userId) {
          await tx.notification.create({
            data: {
              userId: document.student.userId,
              type: "DOCUMENT_REVIEW_UPDATE",
              message:
                parsed.data.decision === "ACCEPTED"
                  ? `${document.type} has been verified.`
                  : `${document.type} requires your action: ${note || "Please review and resubmit."}`,
              linkUrl: "/student/documents",
            },
          });
        }

        await finalizeChecklistIfComplete(tx, item.checklistId, session.user.id);
      }

      return scan;
    });

    if (document.type === "PASSPORT" && document.student.userId) {
      const message =
        parsed.data.decision === "ACCEPTED"
          ? "Your passport has been verified."
          : parsed.data.decision === "REVISION_REQUIRED"
          ? note
            ? `Your passport needs revision. Note: ${note}`
            : "Your passport needs revision. Please re-upload."
          : note
          ? `Your passport was rejected. Reason: ${note}`
          : "Your passport has been rejected.";

      await NotificationService.createNotification({
        userId: document.student.userId,
        type:
          parsed.data.decision === "ACCEPTED"
            ? "DOCUMENT_VERIFIED"
            : parsed.data.decision === "REVISION_REQUIRED"
            ? "DOCUMENT_REVISION_REQUIRED"
            : "DOCUMENT_REJECTED",
        message,
        linkUrl: "/student/documents",
        actorUserId: session.user.id,
      }).catch(() => undefined);
    }

    return NextResponse.json({
      data: {
        documentId: document.id,
        decision: updated.counsellorDecision,
        note: updated.counsellorNote,
      },
    });
  } catch (error) {
    console.error("[/api/admin/documents/[id]/decision POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
