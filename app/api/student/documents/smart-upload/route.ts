import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { DocumentType } from "@prisma/client";
import { NotificationService } from "@/lib/notifications";

const bodySchema = z.object({
  itemLabel: z.string().min(1),
  itemKind: z.string().min(1),
  qualificationId: z.string().optional(),
  fileName: z.string().min(1),
  fileUrl: z.string().min(1),
});

function toDocumentType(kind: string): DocumentType {
  const value = kind.toUpperCase();
  if (value.includes("PASSPORT")) return DocumentType.PASSPORT;
  if (value.includes("TRANSCRIPT")) return DocumentType.TRANSCRIPT;
  if (value.includes("CERTIFICATE") || value.includes("DEGREE")) return DocumentType.DEGREE_CERT;
  if (value.includes("IELTS") || value.includes("TOEFL") || value.includes("PTE") || value.includes("DUOLINGO") || value.includes("OET") || value.includes("ENGLISH")) return DocumentType.ENGLISH_TEST;
  if (value.includes("SOP") || value.includes("PERSONAL_STATEMENT")) return DocumentType.SOP;
  if (value.includes("CV") || value.includes("RESUME")) return DocumentType.CV;
  if (value.includes("BANK") || value.includes("FINANCIAL") || value.includes("FUNDS")) return DocumentType.FINANCIAL_PROOF;
  if (value.includes("VISA") || value.includes("TB") || value.includes("OSHC") || value.includes("AFFIDAVIT")) return DocumentType.VISA_DOCUMENT;
  if (value.includes("REFERENCE") || value.includes("LOR")) return DocumentType.LOR;
  return DocumentType.OTHER;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.roleName !== "STUDENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
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
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const document = await db.document.create({
    data: {
      studentId: student.id,
      type: toDocumentType(parsed.data.itemKind),
      fileName: parsed.data.fileName,
      fileUrl: parsed.data.fileUrl,
      status: "PENDING",
    },
    select: { id: true },
  });

  if (parsed.data.qualificationId && parsed.data.itemKind.toUpperCase().includes("TRANSCRIPT")) {
    await db.studentQualification.updateMany({
      where: {
        id: parsed.data.qualificationId,
        academicProfile: { student: { id: student.id } },
      },
      data: { transcriptDocId: document.id },
    });
  }

  const studentName = `${student.firstName} ${student.lastName}`.trim();
  if (student.assignedCounsellorId) {
    await NotificationService.createNotification({
      userId: student.assignedCounsellorId,
      type: "DOCUMENT_UPLOADED",
      message: `${studentName} uploaded ${parsed.data.itemLabel}. Please review it.`,
      linkUrl: `/dashboard/students/${student.id}`,
      actorUserId: session.user.id,
    }).catch(() => undefined);
  }

  if (student.subAgent?.userId) {
    await NotificationService.createNotification({
      userId: student.subAgent.userId,
      type: "DOCUMENT_UPLOADED",
      message: `${studentName} uploaded ${parsed.data.itemLabel}. Please review it.`,
      linkUrl: `/agent/students/${student.id}`,
      actorUserId: session.user.id,
    }).catch(() => undefined);
  }

  return NextResponse.json({ data: { documentId: document.id } }, { status: 201 });
}
