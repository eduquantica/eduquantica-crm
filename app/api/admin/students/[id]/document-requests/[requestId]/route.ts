import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { NotificationService } from "@/lib/notifications";

const STAFF_ROLES = new Set(["ADMIN", "MANAGER", "COUNSELLOR", "SUB_AGENT", "BRANCH_MANAGER"]);

const patchSchema = z.object({
  action: z.enum(["VERIFY", "REQUEST_REVISION"]),
  note: z.string().optional().nullable(),
});

async function canAccessStudent(userId: string, roleName: string | undefined, studentId: string) {
  if (!roleName || !STAFF_ROLES.has(roleName)) return false;
  if (roleName === "ADMIN" || roleName === "MANAGER") return true;

  if (roleName === "COUNSELLOR") {
    const student = await db.student.findUnique({ where: { id: studentId }, select: { assignedCounsellorId: true } });
    return student?.assignedCounsellorId === userId;
  }

  if (roleName === "SUB_AGENT" || roleName === "BRANCH_MANAGER") {
    const subAgent = await db.subAgent.findUnique({ where: { userId }, select: { id: true } });
    const staff = await db.subAgentStaff.findUnique({ where: { userId }, select: { id: true, subAgentId: true } });
    const student = await db.student.findUnique({ where: { id: studentId }, select: { subAgentId: true, subAgentStaffId: true } });
    if (!student) return false;
    if (staff?.id && staff.subAgentId === student.subAgentId) return student.subAgentStaffId === staff.id || roleName === "SUB_AGENT";
    if (subAgent?.id) return subAgent.id === student.subAgentId;
    return false;
  }

  return false;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string; requestId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !STAFF_ROLES.has(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await db.documentRequest.findFirst({
    where: { id: params.requestId, studentId: params.id },
    select: { id: true, studentId: true, uploadedFileUrl: true, uploadedDocumentId: true, documentLabel: true, student: { select: { userId: true } } },
  });

  if (!existing) {
    return NextResponse.json({ error: "Document request not found" }, { status: 404 });
  }

  const allowed = await canAccessStudent(session.user.id, session.user.roleName, existing.studentId);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
  }

  const note = parsed.data.note?.trim() || null;

  if (parsed.data.action === "VERIFY") {
    if (!existing.uploadedFileUrl) {
      return NextResponse.json({ error: "No uploaded file to verify" }, { status: 400 });
    }

    const updated = await db.$transaction(async (tx) => {
      const request = await tx.documentRequest.update({
        where: { id: existing.id },
        data: {
          status: "VERIFIED",
          verificationStatus: "VERIFIED",
          verifiedBy: session.user.id,
          verifiedAt: new Date(),
          revisionNote: null,
        },
      });

      if (existing.uploadedDocumentId) {
        await tx.document.updateMany({ where: { id: existing.uploadedDocumentId }, data: { status: "VERIFIED" } });
      }

      return request;
    });

    await NotificationService.createNotification({
      userId: existing.student.userId,
      type: "DOCUMENT_VERIFIED",
      message: `Your ${existing.documentLabel} has been verified.`,
      linkUrl: "/student/documents",
      actorUserId: session.user.id,
    }).catch(() => undefined);

    return NextResponse.json({ data: updated });
  }

  const updated = await db.$transaction(async (tx) => {
    const request = await tx.documentRequest.update({
      where: { id: existing.id },
      data: {
        status: "NEEDS_REVISION",
        verificationStatus: "NEEDS_REVISION",
        verifiedBy: session.user.id,
        verifiedAt: new Date(),
        revisionNote: note,
      },
    });

    if (existing.uploadedDocumentId) {
      await tx.document.updateMany({ where: { id: existing.uploadedDocumentId }, data: { status: "REJECTED" } });
    }

    return request;
  });

  await NotificationService.createNotification({
    userId: existing.student.userId,
    type: "DOCUMENT_REVISION_REQUIRED",
    message: note
      ? `Your ${existing.documentLabel} needs revision. Note: ${note}`
      : `Your ${existing.documentLabel} needs revision. Please re-upload.`,
    linkUrl: "/student/documents",
    actorUserId: session.user.id,
  }).catch(() => undefined);

  return NextResponse.json({ data: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; requestId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !["ADMIN", "MANAGER"].includes(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await db.documentRequest.findFirst({
    where: { id: params.requestId, studentId: params.id },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Document request not found" }, { status: 404 });
  }

  await db.documentRequest.delete({ where: { id: existing.id } });
  return NextResponse.json({ ok: true });
}
