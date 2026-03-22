import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { NotificationService } from "@/lib/notifications";

const STAFF_ROLES = new Set(["ADMIN", "MANAGER", "COUNSELLOR", "SUB_AGENT", "BRANCH_MANAGER"]);

const createSchema = z.object({
  documentLabel: z.string().min(1),
  notes: z.string().optional().nullable(),
});

async function canAccessStudent(userId: string, roleName: string | undefined, studentId: string) {
  if (!roleName || !STAFF_ROLES.has(roleName)) return false;
  if (roleName === "ADMIN" || roleName === "MANAGER") return true;

  if (roleName === "COUNSELLOR") {
    const student = await db.student.findUnique({
      where: { id: studentId },
      select: { assignedCounsellorId: true },
    });
    return student?.assignedCounsellorId === userId;
  }

  if (roleName === "SUB_AGENT" || roleName === "BRANCH_MANAGER") {
    const subAgent = await db.subAgent.findUnique({ where: { userId }, select: { id: true } });
    const staff = await db.subAgentStaff.findUnique({ where: { userId }, select: { id: true, subAgentId: true } });

    const student = await db.student.findUnique({
      where: { id: studentId },
      select: { subAgentId: true, subAgentStaffId: true },
    });

    if (!student) return false;

    if (staff?.id && staff.subAgentId === student.subAgentId) {
      return student.subAgentStaffId === staff.id || roleName === "SUB_AGENT";
    }

    if (subAgent?.id) {
      return subAgent.id === student.subAgentId;
    }

    return false;
  }

  return false;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !STAFF_ROLES.has(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await canAccessStudent(session.user.id, session.user.roleName, params.id);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const requests = await db.documentRequest.findMany({
    where: { studentId: params.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      documentType: true,
      documentLabel: true,
      customLabel: true,
      notes: true,
      requestedBy: true,
      requestedByRole: true,
      requestedByName: true,
      status: true,
      uploadedFileUrl: true,
      uploadedFileName: true,
      uploadedAt: true,
      verifiedBy: true,
      verifiedAt: true,
      verificationStatus: true,
      revisionNote: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ data: requests });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !STAFF_ROLES.has(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await canAccessStudent(session.user.id, session.user.roleName, params.id);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
  }

  const student = await db.student.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      userId: true,
    },
  });

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const label = parsed.data.documentLabel.trim();
  const notes = parsed.data.notes?.trim() || null;
  const request = await db.documentRequest.create({
    data: {
      studentId: student.id,
      documentType: "CUSTOM",
      documentLabel: label,
      customLabel: label,
      notes,
      requestedBy: session.user.id,
      requestedByRole: session.user.roleName,
      requestedByName: session.user.name || session.user.email || session.user.roleName,
      status: "PENDING",
      verificationStatus: "PENDING",
    },
  });

  await NotificationService.createNotification({
    userId: student.userId,
    type: "DOCUMENT_REQUESTED",
    message: notes
      ? `${request.requestedByName} has requested: ${label}. Note: ${notes}`
      : `${request.requestedByName} has requested: ${label}. Please upload it in your Documents section.`,
    linkUrl: "/student/documents",
    actorUserId: session.user.id,
  }).catch(() => undefined);

  return NextResponse.json({ data: request }, { status: 201 });
}
