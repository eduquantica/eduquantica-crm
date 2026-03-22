import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { finalizeChecklistIfComplete } from "@/lib/checklist-review";
import { runDocumentScan } from "@/lib/document-scan-service";

const VIEW_ROLES = new Set(["ADMIN", "MANAGER", "COUNSELLOR"]);

const actionSchema = z.object({
  action: z.enum(["VERIFY", "REVISION_REQUIRED", "REJECT", "RESCAN"]),
  note: z.string().trim().optional(),
});

async function loadItem(itemId: string) {
  return db.checklistItem.findUnique({
    where: { id: itemId },
    include: {
      checklist: {
        select: {
          id: true,
          student: {
            select: {
              id: true,
              userId: true,
              firstName: true,
              lastName: true,
              email: true,
              assignedCounsellorId: true,
              assignedCounsellor: { select: { id: true, name: true, email: true } },
            },
          },
          application: {
            select: {
              id: true,
              course: { select: { name: true, university: { select: { name: true } } } },
            },
          },
        },
      },
      document: {
        select: {
          id: true,
          fileName: true,
          fileUrl: true,
          status: true,
          uploadedAt: true,
          scanResult: {
            select: {
              id: true,
              status: true,
              plagiarismScore: true,
              aiScore: true,
              flagColour: true,
              counsellorDecision: true,
              counsellorNote: true,
              reviewedAt: true,
              isLocked: true,
              reportUrl: true,
            },
          },
        },
      },
    },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { itemId: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !VIEW_ROLES.has(session.user.roleName)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const item = await loadItem(params.itemId);
    if (!item || !item.documentId || !item.document) {
      return NextResponse.json({ error: "Checklist item not found" }, { status: 404 });
    }

    if (
      session.user.roleName === "COUNSELLOR" &&
      item.checklist.student.assignedCounsellorId !== session.user.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      data: {
        id: item.id,
        checklistId: item.checklistId,
        label: item.label,
        documentType: item.documentType,
        status: item.status,
        counsellorNote: item.counsellorNote,
        ocrStatus: item.ocrStatus,
        ocrData: item.ocrData,
        ocrConfidence: item.ocrConfidence,
        fraudRiskLevel: item.fraudRiskLevel,
        fraudFlags: item.fraudFlags,
        verifiedAt: item.verifiedAt?.toISOString() || null,
        student: {
          id: item.checklist.student.id,
          name: `${item.checklist.student.firstName} ${item.checklist.student.lastName}`.trim(),
          email: item.checklist.student.email,
          counsellorName:
            item.checklist.student.assignedCounsellor?.name ||
            item.checklist.student.assignedCounsellor?.email ||
            "Unassigned",
        },
        application: {
          id: item.checklist.application?.id || null,
          university: item.checklist.application?.course.university.name || "-",
          course: item.checklist.application?.course.name || "-",
        },
        document: {
          id: item.document.id,
          fileName: item.document.fileName,
          fileUrl: item.document.fileUrl,
          status: item.document.status,
          uploadedAt: item.document.uploadedAt.toISOString(),
          scan: item.document.scanResult,
        },
      },
    });
  } catch (error) {
    console.error("[/api/admin/document-verification/[itemId] GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { itemId: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !VIEW_ROLES.has(session.user.roleName)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = actionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }

    const item = await loadItem(params.itemId);
    if (!item || !item.documentId || !item.document) {
      return NextResponse.json({ error: "Checklist item not found" }, { status: 404 });
    }

    if (
      session.user.roleName === "COUNSELLOR" &&
      item.checklist.student.assignedCounsellorId !== session.user.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const note = parsed.data.note?.trim() || null;

    if ((parsed.data.action === "REVISION_REQUIRED" || parsed.data.action === "REJECT") && !note) {
      return NextResponse.json({ error: "Reason is required" }, { status: 400 });
    }

    if (parsed.data.action === "RESCAN") {
      if (item.document.scanResult?.isLocked && session.user.roleName !== "ADMIN") {
        return NextResponse.json({ error: "Scan is locked. Ask admin to unlock." }, { status: 409 });
      }
      const result = await runDocumentScan(item.id);
      return NextResponse.json({ data: { rescanned: true, ocrStatus: result.ocrStatus } });
    }

    const decision =
      parsed.data.action === "VERIFY"
        ? "ACCEPTED"
        : parsed.data.action === "REVISION_REQUIRED"
          ? "REVISION_REQUIRED"
          : "REJECTED";

    const docStatus = parsed.data.action === "VERIFY" ? "VERIFIED" : "REJECTED";
    const itemStatus = parsed.data.action === "VERIFY" ? "VERIFIED" : "REJECTED";

    await db.$transaction(async (tx) => {
      await tx.document.update({
        where: { id: item.documentId! },
        data: { status: docStatus },
      });

      await tx.documentScanResult.upsert({
        where: { documentId: item.documentId! },
        update: {
          counsellorDecision: decision,
          counsellorNote: note,
          reviewedBy: session.user.id,
          reviewedAt: new Date(),
        },
        create: {
          documentId: item.documentId!,
          status: "PENDING",
          counsellorDecision: decision,
          counsellorNote: note,
          reviewedBy: session.user.id,
          reviewedAt: new Date(),
        },
      });

      await tx.checklistItem.update({
        where: { id: item.id },
        data: {
          status: itemStatus,
          counsellorNote: note,
          verifiedBy: parsed.data.action === "VERIFY" ? session.user.id : null,
          verifiedAt: parsed.data.action === "VERIFY" ? new Date() : null,
        },
      });

      await tx.activityLog.create({
        data: {
          userId: session.user.id,
          entityType: "checklist-item",
          entityId: item.id,
          action: `checklist_item_${parsed.data.action.toLowerCase()}`,
          details: `${item.label}: ${note || "No note"}`,
        },
      });

      if (item.checklist.student.userId) {
        await tx.notification.create({
          data: {
            userId: item.checklist.student.userId,
            type: "DOCUMENT_REVIEW_UPDATE",
            message:
              parsed.data.action === "VERIFY"
                ? `${item.label} has been verified.`
                : `${item.label} requires your action: ${note || "Please review and re-upload."}`,
            linkUrl: "/student/documents",
          },
        });
      }

      await finalizeChecklistIfComplete(tx, item.checklistId, session.user.id);
    });

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error("[/api/admin/document-verification/[itemId] POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
