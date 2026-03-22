import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { DocumentType } from "@prisma/client";
import { removeUploadByUrl } from "@/lib/local-upload";

function resolveDocumentType(raw: string | null): DocumentType | null {
  const value = String(raw || "").toUpperCase();
  if (value === "SOP") return DocumentType.SOP;
  if (value === "PERSONAL_STATEMENT") return DocumentType.PERSONAL_STATEMENT;
  return null;
}

async function resolveStudentId(userId: string) {
  const student = await db.student.findUnique({
    where: { userId },
    select: { id: true },
  });
  return student?.id || null;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.roleName !== "STUDENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const documentType = resolveDocumentType(request.nextUrl.searchParams.get("documentType"));
  if (!documentType) {
    return NextResponse.json({ error: "documentType is required" }, { status: 400 });
  }

  const studentId = await resolveStudentId(session.user.id);
  if (!studentId) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const document = await db.document.findFirst({
    where: {
      studentId,
      type: documentType,
    },
    orderBy: { uploadedAt: "desc" },
    select: {
      id: true,
      fileName: true,
      fileUrl: true,
      uploadedAt: true,
    },
  });

  return NextResponse.json({ data: { document } });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.roleName !== "STUDENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    documentType?: string;
    fileName?: string;
    fileUrl?: string;
  };

  const documentType = resolveDocumentType(body.documentType || null);
  const fileName = String(body.fileName || "").trim();
  const fileUrl = String(body.fileUrl || "").trim();

  if (!documentType || !fileName || !fileUrl) {
    return NextResponse.json({ error: "documentType, fileName and fileUrl are required" }, { status: 400 });
  }

  const studentId = await resolveStudentId(session.user.id);
  if (!studentId) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const previous = await db.document.findFirst({
    where: { studentId, type: documentType },
    orderBy: { uploadedAt: "desc" },
    select: { id: true, fileUrl: true },
  });

  const document = await db.document.create({
    data: {
      studentId,
      type: documentType,
      fileName,
      fileUrl,
      status: "PENDING",
    },
    select: {
      id: true,
      fileName: true,
      fileUrl: true,
      uploadedAt: true,
    },
  });

  if (previous?.id) {
    await db.documentScanResult.deleteMany({ where: { documentId: previous.id } });
    await db.document.delete({ where: { id: previous.id } });
    await removeUploadByUrl(previous.fileUrl);
  }

  return NextResponse.json({ data: { document } });
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.roleName !== "STUDENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const documentType = resolveDocumentType(request.nextUrl.searchParams.get("documentType"));
  if (!documentType) {
    return NextResponse.json({ error: "documentType is required" }, { status: 400 });
  }

  const studentId = await resolveStudentId(session.user.id);
  if (!studentId) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const existing = await db.document.findFirst({
    where: {
      studentId,
      type: documentType,
    },
    orderBy: { uploadedAt: "desc" },
    select: {
      id: true,
      fileUrl: true,
    },
  });

  if (!existing) {
    return NextResponse.json({ data: { ok: true } });
  }

  await db.documentScanResult.deleteMany({ where: { documentId: existing.id } });
  await db.document.delete({ where: { id: existing.id } });
  await removeUploadByUrl(existing.fileUrl);

  return NextResponse.json({ data: { ok: true } });
}
