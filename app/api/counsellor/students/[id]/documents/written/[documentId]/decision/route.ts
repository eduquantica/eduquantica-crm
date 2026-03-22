import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { DocumentType } from "@prisma/client";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { NotificationService } from "@/lib/notifications";
import { createWrittenDocumentPdf, uploadWrittenDocumentPdf } from "@/lib/written-document-pdf";

const decisionSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  reason: z.string().optional(),
});

const ALLOWED_ROLES = new Set(["ADMIN", "MANAGER", "COUNSELLOR"]);

async function ensurePdf(document: {
  id: string;
  title: string;
  content: string;
  documentType: "SOP" | "PERSONAL_STATEMENT";
  convertedPdfUrl: string | null;
  student: { firstName: string; lastName: string };
}) {
  if (document.convertedPdfUrl) return document.convertedPdfUrl;

  const bytes = await createWrittenDocumentPdf({
    title: document.title,
    typeLabel: document.documentType === "SOP" ? "Statement of Purpose" : "Personal Statement",
    studentName: `${document.student.firstName} ${document.student.lastName}`.trim(),
    content: document.content,
  });

  const safeTitle = document.title.replace(/[^a-z0-9\-_.]+/gi, "-").toLowerCase();
  const fileName = `${document.documentType.toLowerCase()}-${safeTitle || document.id}.pdf`;
  return uploadWrittenDocumentPdf(fileName, bytes);
}

export async function POST(req: NextRequest, { params }: { params: { id: string; documentId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !ALLOWED_ROLES.has(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = decisionSchema.parse(await req.json().catch(() => ({})));

  const student = await db.student.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      userId: true,
      firstName: true,
      lastName: true,
      assignedCounsellorId: true,
    },
  });

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  if (session.user.roleName === "COUNSELLOR" && student.assignedCounsellorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const document = await db.studentDocument.findFirst({
    where: {
      id: params.documentId,
      studentId: student.id,
      OR: [{ scanStatus: null }, { scanStatus: { not: "DELETED" } }],
    },
    include: {
      student: { select: { firstName: true, lastName: true } },
    },
  });

  if (!document) {
    return NextResponse.json({ error: "Written document not found" }, { status: 404 });
  }

  if (payload.action === "REJECT") {
    const reason = payload.reason?.trim();
    if (!reason) {
      return NextResponse.json({ error: "Rejection reason is required" }, { status: 400 });
    }

    await db.studentDocument.update({
      where: { id: document.id },
      data: {
        status: "REJECTED",
        scanStatus: `REJECTED:${reason}`,
      },
    });

    await NotificationService.createNotification({
      userId: student.userId,
      type: "DOCUMENT_REVIEWED",
      message: `Your ${document.documentType === "SOP" ? "SOP" : "Personal Statement"} has been reviewed. Please make the following changes: ${reason}`,
      linkUrl: "/student/write-sop",
      actorUserId: session.user.id,
    }).catch(() => undefined);

    return NextResponse.json({ data: { ok: true } });
  }

  try {
    const pdfUrl = await ensurePdf(document);
    const checklistDocType = (document.documentType === "SOP" ? "SOP" : "PERSONAL_STATEMENT") as DocumentType;

    const checklist = document.applicationId
      ? await db.documentChecklist.findUnique({ where: { applicationId: document.applicationId } })
      : await db.documentChecklist.findFirst({ where: { studentId: student.id }, orderBy: { createdAt: "desc" } });

    if (!checklist) {
      return NextResponse.json({ error: "Checklist not found for student" }, { status: 400 });
    }

    await db.$transaction(async (tx) => {
      const upload = await tx.document.create({
        data: {
          studentId: student.id,
          applicationId: document.applicationId,
          type: checklistDocType,
          fileName: `${document.title}.pdf`,
          fileUrl: pdfUrl,
          status: "VERIFIED",
        },
      });

      const existingItem = await tx.checklistItem.findFirst({
        where: {
          checklistId: checklist.id,
          documentType: checklistDocType,
        },
      });

      if (existingItem) {
        await tx.checklistItem.update({
          where: { id: existingItem.id },
          data: {
            documentId: upload.id,
            status: "VERIFIED",
            counsellorNote: null,
            verifiedBy: session.user.id,
            verifiedAt: new Date(),
          },
        });
      } else {
        await tx.checklistItem.create({
          data: {
            checklistId: checklist.id,
            documentType: checklistDocType,
            label: checklistDocType === "SOP" ? "Statement of Purpose" : "Personal Statement",
            isRequired: true,
            status: "VERIFIED",
            documentId: upload.id,
            verifiedBy: session.user.id,
            verifiedAt: new Date(),
          },
        });
      }

      await tx.studentDocument.update({
        where: { id: document.id },
        data: {
          status: "APPROVED",
          convertedPdfUrl: pdfUrl,
          scanStatus: "APPROVED",
        },
      });
    });

    await NotificationService.createNotification({
      userId: student.userId,
      type: "DOCUMENT_APPROVED",
      message: `Your ${document.documentType === "SOP" ? "SOP" : "Personal Statement"} has been approved by your counsellor`,
      linkUrl: "/student/documents",
      actorUserId: session.user.id,
    }).catch(() => undefined);

    return NextResponse.json({ data: { ok: true, status: "APPROVED" } });
  } catch (error) {
    console.error("[/api/counsellor/students/[id]/documents/written/[documentId]/decision POST]", error);
    return NextResponse.json({ error: "Failed to update decision" }, { status: 500 });
  }
}
