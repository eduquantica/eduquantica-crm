import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const writeSchema = z.object({
  testType: z.string().trim().min(1, "Test type is required"),
  dateTaken: z.string().trim().optional().nullable(),
  isUKVI: z.boolean().optional().default(false),
  overallScore: z.string().trim().optional().nullable(),
  listeningScore: z.string().trim().optional().nullable(),
  readingScore: z.string().trim().optional().nullable(),
  writingScore: z.string().trim().optional().nullable(),
  speakingScore: z.string().trim().optional().nullable(),
  certificateUrl: z.string().trim().optional().nullable(),
  certificateFileName: z.string().trim().optional().nullable(),
  isVerified: z.boolean().optional().default(false),
});

type SessionUser = {
  id?: string;
  roleName?: string;
  subAgentId?: string;
};

async function resolveSubAgentId(userId: string, sessionSubAgentId?: string) {
  if (sessionSubAgentId) return sessionSubAgentId;
  const owner = await db.subAgent.findUnique({ where: { userId }, select: { id: true } });
  if (owner?.id) return owner.id;

  const staff = await db.subAgentStaff.findUnique({
    where: { userId },
    select: { subAgentId: true, isActive: true },
  });

  if (staff?.isActive && staff.subAgentId) return staff.subAgentId;
  return null;
}

async function canManageStudent(user: SessionUser, studentId: string) {
  if (!user?.id || !user.roleName) return null;

  const student = await db.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      userId: true,
      assignedCounsellorId: true,
      subAgentId: true,
    },
  });

  if (!student) return null;

  if (user.roleName === "ADMIN" || user.roleName === "MANAGER") {
    return student;
  }

  if (user.roleName === "COUNSELLOR") {
    return student.assignedCounsellorId === user.id ? student : null;
  }

  if (
    user.roleName === "SUB_AGENT"
    || user.roleName === "BRANCH_MANAGER"
    || user.roleName === "SUB_AGENT_COUNSELLOR"
    || user.roleName === "BRANCH_COUNSELLOR"
  ) {
    const actorSubAgentId = await resolveSubAgentId(user.id, user.subAgentId);
    return actorSubAgentId && student.subAgentId === actorSubAgentId ? student : null;
  }

  if (user.roleName === "STUDENT") {
    return student.userId === user.id ? student : null;
  }

  return null;
}

async function normalizeByTestType(payload: z.infer<typeof writeSchema>) {
  const testType = await db.testType.findFirst({
    where: {
      isActive: true,
      name: {
        equals: payload.testType,
        mode: "insensitive",
      },
    },
    select: { name: true, isIELTS: true },
  });

  const isIELTS = Boolean(testType?.isIELTS);

  return {
    testType: testType?.name || payload.testType,
    dateTaken: payload.dateTaken ? new Date(payload.dateTaken) : null,
    isUKVI: isIELTS ? Boolean(payload.isUKVI) : false,
    overallScore: payload.overallScore || null,
    listeningScore: isIELTS ? payload.listeningScore || null : null,
    readingScore: isIELTS ? payload.readingScore || null : null,
    writingScore: isIELTS ? payload.writingScore || null : null,
    speakingScore: isIELTS ? payload.speakingScore || null : null,
    certificateUrl: payload.certificateUrl || null,
    certificateFileName: payload.certificateFileName || null,
    isVerified: Boolean(payload.isVerified),
  };
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; scoreId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id, scoreId } = await params;
    const student = await canManageStudent(session.user, id);
    if (!student) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const existing = await db.studentTestScore.findUnique({ where: { id: scoreId }, select: { id: true, studentId: true } });
    if (!existing || existing.studentId !== id) {
      return NextResponse.json({ error: "Test score not found" }, { status: 404 });
    }

    const payload = writeSchema.parse(await req.json());
    const normalized = await normalizeByTestType(payload);

    const updated = await db.studentTestScore.update({
      where: { id: scoreId },
      data: normalized,
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to update test score" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; scoreId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id, scoreId } = await params;
    const student = await canManageStudent(session.user, id);
    if (!student) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const existing = await db.studentTestScore.findUnique({ where: { id: scoreId }, select: { id: true, studentId: true } });
    if (!existing || existing.studentId !== id) {
      return NextResponse.json({ error: "Test score not found" }, { status: 404 });
    }

    await db.studentTestScore.delete({ where: { id: scoreId } });
    return NextResponse.json({ data: { ok: true } });
  } catch {
    return NextResponse.json({ error: "Failed to delete test score" }, { status: 500 });
  }
}
