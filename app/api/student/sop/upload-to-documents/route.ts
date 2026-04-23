import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { UTApi } from "uploadthing/server";
import { saveToStudentDocument } from "@/lib/saveToStudentDocument";

export async function POST(req: NextRequest) {
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

  const token = process.env.UPLOADTHING_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Upload service not configured" }, { status: 500 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  try {
    const utapi = new UTApi({ token });
    const uploaded = await utapi.uploadFiles(file);
    if (uploaded.error || !uploaded.data?.url) {
      throw new Error(uploaded.error?.message || "Upload failed");
    }

    const fileUrl = uploaded.data.url;
    const doc = await saveToStudentDocument(
      student.id,
      "PERSONAL_STATEMENT",
      fileUrl,
      file.name,
      session.user.id,
    );

    return NextResponse.json({
      data: {
        fileUrl,
        fileName: file.name,
        documentId: doc.id,
        uploadedAt: doc.uploadedAt,
      },
    });
  } catch (error) {
    console.error("[/api/student/sop/upload-to-documents POST]", error);
    return NextResponse.json({ error: "Failed to upload SOP to documents" }, { status: 500 });
  }
}
