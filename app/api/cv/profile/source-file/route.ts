import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { removeUploadByUrl } from "@/lib/local-upload";
import { DocumentType } from "@prisma/client";
import { saveToStudentDocument } from "@/lib/saveToStudentDocument";

type SessionUser = {
  id: string;
  roleName: string;
};

async function canAccessStudentForRole(user: SessionUser, studentId: string): Promise<boolean> {
  if (user.roleName === "ADMIN" || user.roleName === "MANAGER") return true;

  if (user.roleName === "COUNSELLOR") {
    const row = await db.student.findUnique({
      where: { id: studentId },
      select: { assignedCounsellorId: true },
    });
    return row?.assignedCounsellorId === user.id;
  }

  if (user.roleName === "SUB_AGENT") {
    const subAgent = await db.subAgent.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!subAgent) return false;

    const staff = await db.subAgentStaff.findUnique({ where: { userId: user.id }, select: { id: true, subAgentId: true } });
    const row = await db.student.findUnique({
      where: { id: studentId },
      select: { subAgentId: true, subAgentStaffId: true },
    });
    if (!row || row.subAgentId !== subAgent.id) return false;

    if (staff?.id) return row.subAgentStaffId === staff.id;
    return true;
  }

  return false;
}

async function resolveStudentTarget(user: SessionUser, studentIdParam: string | null) {
  if (studentIdParam) {
    const canAccess = await canAccessStudentForRole(user, studentIdParam);
    if (!canAccess) return null;

    const student = await db.student.findUnique({ where: { id: studentIdParam }, select: { id: true } });
    return student?.id || null;
  }

  if (user.roleName !== "STUDENT") return null;

  const student = await db.student.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });

  return student?.id || null;
}

async function getLatestCvDocument(studentId: string) {
  return db.document.findFirst({
    where: {
      studentId,
      type: DocumentType.CV,
    },
    orderBy: { uploadedAt: "desc" },
    select: {
      id: true,
      fileName: true,
      fileUrl: true,
      uploadedAt: true,
    },
  });
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as SessionUser;
  const studentId = await resolveStudentTarget(user, request.nextUrl.searchParams.get("studentId"));
  if (!studentId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const document = await getLatestCvDocument(studentId);
  return NextResponse.json({ data: { document } });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as SessionUser;
  const studentId = await resolveStudentTarget(user, request.nextUrl.searchParams.get("studentId"));
  if (!studentId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as { fileName?: string; fileUrl?: string };
  const fileName = String(body.fileName || "").trim();
  const fileUrl = String(body.fileUrl || "").trim();
  if (!fileName || !fileUrl) {
    return NextResponse.json({ error: "fileName and fileUrl are required" }, { status: 400 });
  }

  const previous = await getLatestCvDocument(studentId);

  const saved = await saveToStudentDocument(
    studentId,
    "CV",
    fileUrl,
    fileName,
    user.id,
  );

  const document = {
    id: saved.id,
    fileName: saved.fileName,
    fileUrl: saved.fileUrl,
    uploadedAt: saved.uploadedAt,
  };

  if (previous?.id && previous.id !== saved.id) {
    await db.documentScanResult.deleteMany({ where: { documentId: previous.id } });
    await db.document.delete({ where: { id: previous.id } });
    await removeUploadByUrl(previous.fileUrl);
  }

  return NextResponse.json({ data: { document } });
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as SessionUser;
  const studentId = await resolveStudentTarget(user, request.nextUrl.searchParams.get("studentId"));
  if (!studentId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await getLatestCvDocument(studentId);
  if (!existing) {
    return NextResponse.json({ data: { ok: true } });
  }

  await db.documentScanResult.deleteMany({ where: { documentId: existing.id } });
  await db.document.delete({ where: { id: existing.id } });
  await removeUploadByUrl(existing.fileUrl);

  return NextResponse.json({ data: { ok: true } });
}
