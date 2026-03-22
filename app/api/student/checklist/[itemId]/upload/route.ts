import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { runDocumentScan } from "@/lib/document-scan-service";
import { z } from "zod";
import { NotificationService } from "@/lib/notifications";

const uploadSchema = z.object({
  fileName: z.string().min(1),
  fileUrl: z.string().min(1),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { itemId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      assignedCounsellorId: true,
      subAgent: { select: { userId: true } },
    },
  });

  if (!student) {
    return NextResponse.json({ error: "Not a student" }, { status: 404 });
  }

  try {
    const payload = uploadSchema.parse(await req.json());

    const item = await db.checklistItem.findFirst({
      where: {
        id: params.itemId,
        checklist: { studentId: student.id },
      },
      select: {
        id: true,
        documentType: true,
      },
    });

    if (!item) {
      return NextResponse.json({ error: "Checklist item not found" }, { status: 404 });
    }

    const document = await db.document.create({
      data: {
        studentId: student.id,
        type: item.documentType,
        fileName: payload.fileName,
        fileUrl: payload.fileUrl,
        status: "PENDING",
      },
      select: { id: true },
    });

    await db.checklistItem.update({
      where: { id: item.id },
      data: {
        documentId: document.id,
        status: "UPLOADED",
        ocrStatus: "PENDING",
        fraudRiskLevel: "UNKNOWN",
        fraudFlags: [],
        ocrConfidence: null,
      },
    });

    void runDocumentScan(item.id).catch((error) => {
      console.error(`runDocumentScan failed for checklist item ${item.id}`, error);
    });

    await db.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: "checklistItem",
        entityId: item.id,
        action: "student_document_uploaded",
        details: payload.fileName,
      },
    });

    const studentName = `${student.firstName} ${student.lastName}`.trim();
    if (student.assignedCounsellorId) {
      await NotificationService.createNotification({
        userId: student.assignedCounsellorId,
        type: "DOCUMENT_UPLOADED",
        message: `${studentName} uploaded ${item.documentType.replaceAll("_", " ")}.`,
        linkUrl: `/dashboard/students/${student.id}`,
        actorUserId: session.user.id,
      }).catch(() => undefined);
    }

    if (student.subAgent?.userId) {
      await NotificationService.createNotification({
        userId: student.subAgent.userId,
        type: "DOCUMENT_UPLOADED",
        message: `${studentName} uploaded ${item.documentType.replaceAll("_", " ")}.`,
        linkUrl: `/agent/students/${student.id}`,
        actorUserId: session.user.id,
      }).catch(() => undefined);
    }

    return NextResponse.json({ data: { ok: true } }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
    }

    console.error("[/api/student/checklist/[itemId]/upload POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
