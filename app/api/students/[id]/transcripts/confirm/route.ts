import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { GradeNormaliser } from "@/lib/grade-normalisation";
import { EligibilityMatcher } from "@/lib/eligibility-matcher";
import { matchSubjectName } from "@/lib/transcript-ocr";

const confirmSchema = z.object({
  qualificationId: z.string().min(1),
  subjects: z.array(
    z.object({
      id: z.string().min(1),
      subjectName: z.string().optional(),
      rawGrade: z.string().optional(),
    }),
  ).min(1),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const student = await db.student.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true },
  });

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  if (student.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = confirmSchema.parse(await req.json());

    const qualification = await db.studentQualification.findFirst({
      where: {
        id: payload.qualificationId,
        academicProfile: { studentId: student.id },
      },
      select: {
        id: true,
        qualType: true,
      },
    });

    if (!qualification) {
      return NextResponse.json({ error: "Qualification not found" }, { status: 404 });
    }

    const subjectIds = payload.subjects.map((item) => item.id);

    const existingRows = await db.studentSubjectGrade.findMany({
      where: {
        id: { in: subjectIds },
        qualificationId: qualification.id,
      },
      select: {
        id: true,
        subjectName: true,
        rawGrade: true,
      },
    });

    const rowById = new Map(existingRows.map((row) => [row.id, row]));

    if (existingRows.length !== subjectIds.length) {
      return NextResponse.json({ error: "Some subject rows were not found" }, { status: 404 });
    }

    await db.$transaction(async (tx) => {
      for (const subject of payload.subjects) {
        const existing = rowById.get(subject.id);
        if (!existing) continue;

        const resolvedSubject = (subject.subjectName || existing.subjectName || "").trim();
        const matched = matchSubjectName(resolvedSubject);

        const resolvedGrade = (subject.rawGrade || existing.rawGrade || "").trim();
        const universalScore = resolvedGrade
          ? GradeNormaliser.normalise(resolvedGrade, qualification.qualType)
          : null;

        await tx.studentSubjectGrade.update({
          where: { id: subject.id },
          data: {
            subjectName: matched.matchedName || resolvedSubject,
            subjectCategory: matched.subjectCategory,
            rawGrade: resolvedGrade || null,
            universalScore,
            isConfirmedByStudent: true,
          },
        });
      }

      const remainingUnconfirmed = await tx.studentSubjectGrade.count({
        where: {
          qualificationId: qualification.id,
          isConfirmedByStudent: false,
        },
      });

      await tx.studentQualification.update({
        where: { id: qualification.id },
        data: {
          ocrConfirmedByStudent: remainingUnconfirmed === 0,
        },
      });

      if (remainingUnconfirmed === 0) {
        await tx.studentAcademicProfile.updateMany({
          where: { studentId: student.id },
          data: { isComplete: true },
        });
      }

      await tx.activityLog.create({
        data: {
          userId: session.user.id,
          entityType: "StudentQualification",
          entityId: qualification.id,
          action: "transcript_ocr_confirmed",
          details: `Confirmed rows: ${payload.subjects.length}. Triggered shortlist eligibility recalculation.`,
        },
      });
    });

    const recalculated = await EligibilityMatcher.recalculateForStudentShortlisted(student.id);

    return NextResponse.json({
      data: {
        qualificationId: qualification.id,
        confirmedRows: payload.subjects.length,
        recalculationTriggered: true,
        recalculatedCourses: recalculated.totalCourses,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }

    console.error("[/api/students/[id]/transcripts/confirm POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
