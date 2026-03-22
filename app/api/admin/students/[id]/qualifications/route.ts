import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { QualType } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { GradeNormaliser } from "@/lib/grade-normalisation";
import { StudyGapCalculator } from "@/lib/study-gap";

const schema = z.object({
  qualType: z.nativeEnum(QualType),
  qualName: z.string().min(1),
  institutionName: z.string().optional().nullable(),
  yearCompleted: z.number().int().min(1900).max(2100).optional().nullable(),
  overallGrade: z.string().optional().nullable(),
});

function hasStaffAccess(roleName?: string) {
  return (
    roleName === "ADMIN"
    || roleName === "MANAGER"
    || roleName === "COUNSELLOR"
    || roleName === "SUB_AGENT"
    || roleName === "BRANCH_MANAGER"
    || roleName === "SUB_AGENT_COUNSELLOR"
  );
}

async function canEditStudent(userId: string, roleName: string | undefined, student: {
  userId: string;
  assignedCounsellorId: string | null;
  subAgentId: string | null;
}) {
  if (student.userId === userId) return true;
  if (!hasStaffAccess(roleName)) return false;

  if (roleName === "ADMIN" || roleName === "MANAGER") return true;
  if (roleName === "COUNSELLOR") return student.assignedCounsellorId === userId;

  const [agent, branchStaff] = await Promise.all([
    db.subAgent.findUnique({ where: { userId }, select: { id: true } }),
    db.subAgentStaff.findUnique({ where: { userId }, select: { subAgentId: true } }),
  ]);

  const actorSubAgentId = agent?.id || branchStaff?.subAgentId || null;
  return !!actorSubAgentId && actorSubAgentId === student.subAgentId;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const payload = schema.safeParse(await req.json());
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
  }

  const student = await db.student.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      userId: true,
      assignedCounsellorId: true,
      subAgentId: true,
    },
  });

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const access = await canEditStudent(session.user.id, session.user.roleName, student);
  if (!access) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const profile = await db.studentAcademicProfile.upsert({
    where: { studentId: student.id },
    update: {},
    create: { studentId: student.id },
    select: { id: true },
  });

  const created = await db.studentQualification.create({
    data: {
      academicProfileId: profile.id,
      qualType: payload.data.qualType,
      qualName: payload.data.qualName.trim(),
      institutionName: (payload.data.institutionName || "").trim() || null,
      yearCompleted: payload.data.yearCompleted ?? null,
      overallGrade: (payload.data.overallGrade || "").trim() || null,
      overallUniversal: payload.data.overallGrade
        ? GradeNormaliser.normalise(payload.data.overallGrade.trim(), payload.data.qualType)
        : null,
      status: "COMPLETED",
      ocrConfirmedByStudent: true,
    },
    include: {
      subjects: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  await db.studentAcademicProfile.update({
    where: { id: profile.id },
    data: { isComplete: true },
  });

  await StudyGapCalculator.recalculateAndHandleAlerts(student.id).catch(() => undefined);

  return NextResponse.json({
    data: {
      id: created.id,
      qualName: created.qualName,
      institutionName: created.institutionName,
      yearCompleted: created.yearCompleted,
      overallGrade: created.overallGrade,
      subjects: created.subjects.map((subject) => ({
        id: subject.id,
        subjectName: subject.subjectName,
        rawGrade: subject.rawGrade,
        gradeType: (subject.gradeType as "GPA" | "LETTER") || "LETTER",
        universalScore: subject.universalScore,
      })),
    },
  }, { status: 201 });
}
