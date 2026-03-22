import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { createWrittenDocumentPdf } from "@/lib/written-document-pdf";

type DownloadPayload = {
  title: string;
  typeLabel: string;
  content: string;
};

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  try {
    const payload = (await req.json()) as DownloadPayload;
    if (!payload?.content?.trim()) {
      return NextResponse.json({ error: "Document content is required." }, { status: 400 });
    }

    const typeLabel = payload.typeLabel || "Statement of Purpose";
    const title = payload.title || typeLabel;

    const pdfBytes = await createWrittenDocumentPdf({
      title,
      typeLabel,
      studentName: session.user.name || "EduQuantica Student",
      content: payload.content,
    });

    const safeBase = title.replace(/[^a-z0-9\-_.]+/gi, "-").toLowerCase() || "written-document";
    const fileName = `${safeBase}.pdf`;

    return new NextResponse(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=\"${fileName}\"`,
      },
    });
  } catch (error) {
    console.error("[/api/student/sop/download-pdf POST]", error);
    return NextResponse.json({ error: "Failed to generate PDF." }, { status: 500 });
  }
}
