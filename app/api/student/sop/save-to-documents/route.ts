import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { createWrittenDocumentPdf, uploadWrittenDocumentPdf } from "@/lib/written-document-pdf";
import { saveToStudentDocument } from "@/lib/saveToStudentDocument";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.roleName !== "STUDENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const body = (await req.json()) as { content?: string; typeLabel?: string; docKind?: string };
  const content = String(body.content || "").trim();
  if (!content) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  const typeLabel = String(body.typeLabel || "Statement of Purpose");
  const docKind = String(body.docKind || "SOP");
  const documentType = docKind === "PERSONAL_STATEMENT" ? "PERSONAL_STATEMENT" : "SOP";
  const studentName = `${student.firstName} ${student.lastName}`.trim() || "EduQuantica Student";

  try {
    const pdfBytes = await createWrittenDocumentPdf({
      title: typeLabel,
      typeLabel,
      studentName,
      content,
    });

    const fileName = documentType === "PERSONAL_STATEMENT" ? "Personal-Statement.pdf" : "Statement-of-Purpose.pdf";
    const fileUrl = await uploadWrittenDocumentPdf(fileName, pdfBytes);

    const doc = await saveToStudentDocument(
      student.id,
      documentType,
      fileUrl,
      fileName,
      session.user.id,
    );

    return NextResponse.json({
      data: {
        fileUrl,
        fileName,
        documentId: doc.id,
        uploadedAt: doc.uploadedAt,
      },
    });
  } catch (error) {
    console.error("[/api/student/sop/save-to-documents POST]", error);
    return NextResponse.json({ error: "Failed to save SOP to documents" }, { status: 500 });
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.roleName !== "STUDENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const doc = await db.document.findFirst({
    where: {
      studentId: student.id,
      type: { in: ["SOP", "PERSONAL_STATEMENT"] },
    },
    orderBy: { uploadedAt: "desc" },
    select: {
      id: true,
      fileName: true,
      fileUrl: true,
      uploadedAt: true,
      status: true,
    },
  });

  return NextResponse.json({ data: { document: doc || null } });
}
