import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { DocumentType } from "@prisma/client";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { NotificationService } from "@/lib/notifications";
import { createWrittenDocumentPdf, uploadWrittenDocumentPdf } from "@/lib/written-document-pdf";
import { documentTypeToChecklistType } from "@/lib/written-documents";

const submitSchema = z.object({
  skipGrammar: z.boolean().optional(),
  skipScan: z.boolean().optional(),
  submitHighAi: z.boolean().optional(),
});

async function ensurePdfUrl(document: {
  id: string;
  title: string;
  content: string;
  documentType: "SOP" | "PERSONAL_STATEMENT";
  convertedPdfUrl: string | null;
  student: { firstName: string; lastName: string };
}) {
  if (document.convertedPdfUrl) return document.convertedPdfUrl;

  const pdfBytes = await createWrittenDocumentPdf({
    title: document.title,
    typeLabel: document.documentType === "SOP" ? "Statement of Purpose" : "Personal Statement",
    studentName: `${document.student.firstName} ${document.student.lastName}`.trim(),
    content: document.content,
  });

  const safeTitle = document.title.replace(/[^a-z0-9\-_.]+/gi, "-").toLowerCase();
  const fileName = `${document.documentType.toLowerCase()}-${safeTitle || document.id}.pdf`;
  const url = await uploadWrittenDocumentPdf(fileName, pdfBytes);

  await db.studentDocument.update({
    where: { id: document.id },
    data: { convertedPdfUrl: url },
  });

  return url;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const payload = submitSchema.parse(await req.json().catch(() => ({})));

  const document = await db.studentDocument.findFirst({
    where: {
      id: params.id,
      student: { userId: session.user.id },
      OR: [{ scanStatus: null }, { scanStatus: { not: "DELETED" } }],
    },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          assignedCounsellorId: true,
        },
      },
    },
  });

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  if (!document.grammarScore && !payload.skipGrammar) {
    return NextResponse.json({
      error: "You have not checked grammar yet.",
      code: "GRAMMAR_NOT_CHECKED",
    }, { status: 400 });
  }

  const hasScan = document.plagiarismScore !== null && document.aiContentScore !== null;
  if (!hasScan && !payload.skipScan) {
    return NextResponse.json({
      error: "You have not scanned for plagiarism.",
      code: "SCAN_NOT_CHECKED",
    }, { status: 400 });
  }

  if ((document.plagiarismScore ?? 0) > 30) {
    return NextResponse.json({
      error: "Your document has high similarity. You must reduce similarity before submitting.",
      code: "PLAGIARISM_TOO_HIGH",
    }, { status: 400 });
  }

  if ((document.aiContentScore ?? 0) > 40 && !payload.submitHighAi) {
    return NextResponse.json({
      error: "High AI content detected. Confirm submission if you still want to proceed.",
      code: "AI_HIGH_CONFIRM_REQUIRED",
    }, { status: 400 });
  }

  try {
    const pdfUrl = await ensurePdfUrl(document);
    const checklistType = documentTypeToChecklistType(document.documentType);
    const checklistDocType = checklistType as DocumentType;

    const checklist = document.applicationId
      ? await db.documentChecklist.findUnique({ where: { applicationId: document.applicationId } })
      : await db.documentChecklist.findFirst({
          where: { studentId: document.studentId },
          orderBy: { createdAt: "desc" },
        });

    if (!checklist) {
      return NextResponse.json({ error: "No checklist found for submission" }, { status: 400 });
    }

    const linkedFileName = `${document.title}.pdf`;

    const saved = await db.$transaction(async (tx) => {
      const createdDocument = await tx.document.create({
        data: {
          studentId: document.studentId,
          applicationId: document.applicationId,
          type: checklistDocType,
          fileName: linkedFileName,
          fileUrl: pdfUrl,
          status: "PENDING",
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
            documentId: createdDocument.id,
            status: "UPLOADED",
            counsellorNote: null,
          },
        });
      } else {
        await tx.checklistItem.create({
          data: {
            checklistId: checklist.id,
            documentType: checklistDocType,
            label: checklistType === "SOP" ? "Statement of Purpose" : "Personal Statement",
            isRequired: true,
            status: "UPLOADED",
            documentId: createdDocument.id,
          },
        });
      }

      return tx.studentDocument.update({
        where: { id: document.id },
        data: {
          status: "SCAN_COMPLETE",
          convertedPdfUrl: pdfUrl,
        },
      });
    });

    const studentName = `${document.student.firstName} ${document.student.lastName}`.trim();
    if (document.student.assignedCounsellorId) {
      await NotificationService.createNotification({
        userId: document.student.assignedCounsellorId,
        type: "DOCUMENT_UPLOADED",
        message: `${studentName} has submitted ${document.documentType === "SOP" ? "SOP" : "Personal Statement"} for review`,
        linkUrl: `/dashboard/students/${document.studentId}`,
        actorUserId: session.user.id,
      }).catch(() => undefined);
    }

    return NextResponse.json({
      data: saved,
      message: `Your ${document.documentType === "SOP" ? "SOP" : "Personal Statement"} has been submitted successfully. Your counsellor will review it shortly.`,
    });
  } catch (error) {
    console.error("[/api/student/documents/written/[id]/submit POST]", error);
    return NextResponse.json({ error: "Submission failed" }, { status: 500 });
  }
}
