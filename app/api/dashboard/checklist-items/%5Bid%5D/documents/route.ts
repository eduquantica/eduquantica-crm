import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { runDocumentScan } from "@/lib/document-scan-service";

const linkDocumentSchema = z.object({
  checklistItemId: z.string(),
  documentId: z.string(),
});

/**
 * POST /api/dashboard/checklist-items/[id]/documents
 * Link a document to a checklist item and trigger fraud detection scan
 */
export async function POST(
  req: NextRequest,
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { checklistItemId, documentId } = linkDocumentSchema.parse(body);

    // Verify user has access to this checklist item
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      include: { role: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get checklist item with relations to verify access
    const checklistItem = await db.checklistItem.findUnique({
      where: { id: checklistItemId },
      include: {
        checklist: {
          include: {
            student: true,
          },
        },
      },
    });

    if (!checklistItem) {
      return NextResponse.json({ error: "Checklist item not found" }, { status: 404 });
    }

    // Verify document exists and belongs to the student
    const document = await db.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (document.studentId !== checklistItem.checklist.student.id) {
      return NextResponse.json({ error: "Document does not belong to this student" }, { status: 403 });
    }

    // Check user permissions
    if (user.role.name === "COUNSELLOR") {
      // Counsellors can only manage students assigned to them
      if (checklistItem.checklist.student.assignedCounsellorId !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (user.role.name === "SUB_AGENT") {
      // Sub-agents can only manage their own students
      const subAgent = await db.subAgent.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });
      if (!subAgent || checklistItem.checklist.student.subAgentId !== subAgent.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (user.role.name !== "ADMIN" && user.role.name !== "MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Link document to checklist item
    const updated = await db.checklistItem.update({
      where: { id: checklistItemId },
      data: {
        documentId: documentId,
        status: "UPLOADED",
      },
    });

    // Trigger fraud detection scan asynchronously
    void (async () => {
      try {
        await runDocumentScan(checklistItemId);
      } catch (error) {
        console.error(`Fraud detection scan failed for checklist item ${checklistItemId}:`, error);
        // Log the error but don't fail the request
        await db.activityLog.create({
          data: {
            userId: user.id,
            entityType: "checklistItem",
            entityId: checklistItemId,
            action: "fraud_detection_failed",
            details: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        }).catch(() => {
          // Silently fail if we can't log
        });
      }
    })();

    // Log the activity
    await db.activityLog.create({
      data: {
        userId: user.id,
        entityType: "checklistItem",
        entityId: checklistItemId,
        action: "document_linked",
        details: `Document ${document.fileName} linked for ${document.type}`,
      },
    });

    return NextResponse.json({
      data: {
        checklistItemId: updated.id,
        documentId: updated.documentId,
        status: updated.status,
        message: "Document linked successfully. Fraud detection scan initiated.",
      },
    });
  } catch (error) {
    console.error("[POST /api/dashboard/checklist-items/[id]/documents]", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to link document" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/dashboard/checklist-items/[id]/documents
 * Unlink a document from a checklist item
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { email: session.user.email },
      include: { role: true },
    });

    if (!user || (user.role.name !== "ADMIN" && user.role.name !== "MANAGER" && user.role.name !== "COUNSELLOR")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get checklist item with relations to verify access
    const checklistItem = await db.checklistItem.findUnique({
      where: { id: params.id },
      include: {
        checklist: {
          include: {
            student: true,
          },
        },
        document: true,
      },
    });

    if (!checklistItem) {
      return NextResponse.json({ error: "Checklist item not found" }, { status: 404 });
    }

    // Verify counsellor can only manage assigned students
    if (user.role.name === "COUNSELLOR" && checklistItem.checklist.student.assignedCounsellorId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Unlink document and reset OCR data
    const updated = await db.checklistItem.update({
      where: { id: params.id },
      data: {
        documentId: null,
        status: "PENDING",
        ocrStatus: null,
        ocrData: Prisma.JsonNull,
        fraudRiskLevel: "UNKNOWN",
        fraudFlags: [],
        ocrConfidence: null,
      },
    });

    // Log the activity
    await db.activityLog.create({
      data: {
        userId: user.id,
        entityType: "checklistItem",
        entityId: params.id,
        action: "document_unlinked",
        details: `Removed: ${checklistItem.document?.fileName || "unknown"}`,
      },
    });

    return NextResponse.json({
      data: {
        checklistItemId: updated.id,
        documentId: updated.documentId,
        status: updated.status,
        message: "Document unlinked successfully.",
      },
    });
  } catch (error) {
    console.error("[PUT /api/dashboard/checklist-items/[id]/documents]", error);
    return NextResponse.json(
      { error: "Failed to unlink document" },
      { status: 500 },
    );
  }
}
