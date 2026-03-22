import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { createWrittenDocumentPdf, uploadWrittenDocumentPdf } from "@/lib/written-document-pdf";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const document = await db.studentDocument.findFirst({
    where: {
      id: params.id,
      student: { userId: session.user.id },
      OR: [{ scanStatus: null }, { scanStatus: { not: "DELETED" } }],
    },
    include: {
      student: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  try {
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

    return NextResponse.json({ data: { pdfUrl: url } });
  } catch (error) {
    console.error("[/api/student/documents/written/[id]/convert-to-pdf POST]", error);
    return NextResponse.json({ error: "Failed to convert document to PDF" }, { status: 500 });
  }
}
