import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { GradeNormaliser } from "@/lib/grade-normalisation";
import { matchSubjectName } from "@/lib/transcript-ocr";

const schema = z.object({
  subjectName: z.string().min(1),
  grade: z.string().optional().nullable(),
  gradeType: z.enum(["GPA", "LETTER"]).optional(),
});

const LETTER_OPTIONS = new Set(["A*", "A", "A-", "B+", "B", "B-", "C+", "C", "C-"]);

function normaliseGrade(grade: string, gradeType: "GPA" | "LETTER"): string {
  const cleaned = grade.trim().toUpperCase();
  if (gradeType === "GPA") {
    const numeric = Number(cleaned);
    if (Number.isNaN(numeric) || numeric < 0 || numeric > 5) {
      throw new Error("GPA must be a number between 0.0 and 5.0");
    }
    return numeric.toString();
  }

  if (!LETTER_OPTIONS.has(cleaned)) {
    throw new Error("Letter grade must be one of: A*, A, A-, B+, B, B-, C+, C, C-");
  }
  return cleaned;
}

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

async function canEditQualification(userId: string, roleName: string | undefined, student: {
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

async function findEditableQualification(qualificationId: string, userId: string, roleName: string | undefined) {
  const qualification = await db.studentQualification.findUnique({
    where: { id: qualificationId },
    select: {
      id: true,
      qualType: true,
      academicProfile: {
        select: {
          student: {
            select: {
              userId: true,
              assignedCounsellorId: true,
              subAgentId: true,
            },
          },
        },
      },
    },
  });

  if (!qualification) return null;

  const access = await canEditQualification(
    userId,
    roleName,
    qualification.academicProfile.student,
  );

  if (!access) return null;

  return qualification;
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

  const qualification = await findEditableQualification(params.id, session.user.id, session.user.roleName);
  if (!qualification) {
    return NextResponse.json({ error: "Qualification not found" }, { status: 404 });
  }

  const resolvedGradeType = payload.data.gradeType || "LETTER";
  const resolvedGrade = (payload.data.grade || "").trim();

  let cleanedGrade: string | null = null;
  if (resolvedGrade) {
    try {
      cleanedGrade = normaliseGrade(resolvedGrade, resolvedGradeType);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid grade" },
        { status: 400 },
      );
    }
  }

  const matched = matchSubjectName(payload.data.subjectName.trim());
  const created = await db.studentSubjectGrade.create({
    data: {
      qualificationId: qualification.id,
      subjectName: matched.matchedName || payload.data.subjectName.trim(),
      subjectCategory: matched.subjectCategory,
      rawGrade: cleanedGrade,
      gradeType: resolvedGradeType,
      universalScore: cleanedGrade ? GradeNormaliser.normalise(cleanedGrade, qualification.qualType) : null,
      isOcrExtracted: false,
      isConfirmedByStudent: true,
      ocrConfidence: matched.confidence,
    },
  });

  return NextResponse.json({
    data: {
      id: created.id,
      subjectName: created.subjectName,
      rawGrade: created.rawGrade,
      gradeType: created.gradeType as "GPA" | "LETTER",
      universalScore: created.universalScore,
    },
  }, { status: 201 });
}
