import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({
  counsellorFlagNote: z.string().trim().max(1000).nullable(),
});

function canAccessEligibilityTools(roleName?: string): boolean {
  return ["COUNSELLOR", "ADMIN", "MANAGER", "SUB_AGENT", "BRANCH_MANAGER", "SUB_AGENT_COUNSELLOR"].includes(roleName || "");
}

function canRemoveOverride(roleName?: string): boolean {
  return roleName === "ADMIN" || roleName === "MANAGER";
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; courseId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  if (!canAccessEligibilityTools(session.user.roleName)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
  }

  const student = await db.student.findUnique({
    where: { id: params.id },
    select: { id: true, assignedCounsellorId: true },
  });

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  if (session.user.roleName === "COUNSELLOR" && student.assignedCounsellorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await db.courseEligibilityResult.findUnique({
    where: {
      studentId_courseId: {
        studentId: student.id,
        courseId: params.courseId,
      },
    },
    select: {
      id: true,
      counsellorFlagNote: true,
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Eligibility result not found" }, { status: 404 });
  }

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.courseEligibilityResult.update({
      where: {
        studentId_courseId: {
          studentId: student.id,
          courseId: params.courseId,
        },
      },
      data: {
        counsellorFlagNote: parsed.data.counsellorFlagNote,
      },
      select: {
        id: true,
        counsellorFlagNote: true,
      },
    });

    await tx.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: "CourseEligibilityResult",
        entityId: existing.id,
        action: "counsellor_note_updated",
        details: "Updated counsellor note for course eligibility match",
      },
    });

    return result;
  });

  return NextResponse.json({ data: updated });
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string; courseId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  if (!canAccessEligibilityTools(session.user.roleName)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const student = await db.student.findUnique({
    where: { id: params.id },
    select: { id: true, assignedCounsellorId: true },
  });

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  if (session.user.roleName === "COUNSELLOR" && student.assignedCounsellorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await db.eligibilityOverride.findUnique({
    where: {
      studentId_courseId: {
        studentId: student.id,
        courseId: params.courseId,
      },
    },
    select: { id: true },
  });

  if (existing) {
    return NextResponse.json({ data: { alreadyExists: true } });
  }

  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { name: true } });

  const created = await db.eligibilityOverride.create({
    data: {
      studentId: student.id,
      courseId: params.courseId,
      overriddenById: session.user.id,
      overriddenByName: user?.name || "Staff",
      reason: "Manual eligibility override",
    },
    select: {
      id: true,
      overriddenByName: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ data: created }, { status: 201 });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; courseId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  if (!canRemoveOverride(session.user.roleName)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await db.eligibilityOverride.findUnique({
    where: {
      studentId_courseId: {
        studentId: params.id,
        courseId: params.courseId,
      },
    },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ data: { removed: false } });
  }

  await db.eligibilityOverride.delete({
    where: {
      studentId_courseId: {
        studentId: params.id,
        courseId: params.courseId,
      },
    },
  });

  return NextResponse.json({ data: { removed: true } });
}
