import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { GradeNormaliser } from "@/lib/grade-normalisation";
import { EligibilityMatcher } from "@/lib/eligibility-matcher";
import { matchSubjectName } from "@/lib/transcript-ocr";

const updateGradeSchema = z.object({
  subjectId: z.string().min(1),
  subjectName: z.string().min(1).optional(),
  rawGrade: z.string().optional(),
});

function canAccessEligibilityTools(roleName?: string): boolean {
  return roleName === "COUNSELLOR" || roleName === "ADMIN" || roleName === "MANAGER";
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  if (!canAccessEligibilityTools(session.user.roleName)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = updateGradeSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
  }

  const student = await db.student.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      assignedCounsellorId: true,
    },
  });

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  if (session.user.roleName === "COUNSELLOR" && student.assignedCounsellorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const subject = await db.studentSubjectGrade.findFirst({
    where: {
      id: parsed.data.subjectId,
      qualification: {
        academicProfile: {
          studentId: student.id,
        },
      },
    },
    select: {
      id: true,
      subjectName: true,
      rawGrade: true,
      qualification: {
        select: {
          id: true,
          qualType: true,
        },
      },
    },
  });

  if (!subject) {
    return NextResponse.json({ error: "Subject row not found" }, { status: 404 });
  }

  const resolvedSubjectName = (parsed.data.subjectName || subject.subjectName || "").trim();
  const matched = matchSubjectName(resolvedSubjectName);

  const hasRawGradeField = Object.prototype.hasOwnProperty.call(parsed.data, "rawGrade");
  const resolvedRawGrade = hasRawGradeField
    ? (parsed.data.rawGrade || "").trim()
    : (subject.rawGrade || "").trim();

  const universalScore = resolvedRawGrade
    ? GradeNormaliser.normalise(resolvedRawGrade, subject.qualification.qualType)
    : null;

  const updated = await db.$transaction(async (tx) => {
    const updatedRow = await tx.studentSubjectGrade.update({
      where: { id: subject.id },
      data: {
        subjectName: matched.matchedName || resolvedSubjectName,
        subjectCategory: matched.subjectCategory,
        rawGrade: resolvedRawGrade || null,
        universalScore,
        isConfirmedByStudent: true,
      },
      select: {
        id: true,
        subjectName: true,
        rawGrade: true,
        universalScore: true,
        subjectCategory: true,
      },
    });

    await tx.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: "StudentQualification",
        entityId: subject.qualification.id,
        action: "counsellor_grade_updated",
        details: `Updated subject ${subject.subjectName} (${subject.rawGrade || "-"}) to ${updatedRow.subjectName} (${updatedRow.rawGrade || "-"})`,
      },
    });

    return updatedRow;
  });

  const recalculated = await EligibilityMatcher.recalculateForStudentShortlisted(student.id);

  return NextResponse.json({
    data: {
      subject: updated,
      recalculatedCourses: recalculated.totalCourses,
    },
  });
}
