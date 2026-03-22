import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { GradeNormaliser } from "@/lib/grade-normalisation";
import { EligibilityMatcher } from "@/lib/eligibility-matcher";
import { matchSubjectName } from "@/lib/transcript-ocr";
import { NotificationService } from "@/lib/notifications";

const confirmSchema = z.object({
  subjects: z.array(
    z.object({
      subjectName: z.string().min(1),
      rawGrade: z.string().optional(),
      gradeType: z.enum(["GPA", "LETTER"]).optional(),
      confidence: z.number().min(0).max(1).optional(),
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

  const payload = confirmSchema.safeParse(await req.json());
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
  }

  const qualification = await db.studentQualification.findFirst({
    where: {
      id: params.id,
      academicProfile: {
        student: {
          userId: session.user.id,
        },
      },
    },
    select: {
      id: true,
      qualType: true,
      academicProfileId: true,
      academicProfile: {
        select: {
          studentId: true,
          student: {
            select: {
              firstName: true,
              lastName: true,
              assignedCounsellorId: true,
            },
          },
        },
      },
    },
  });

  if (!qualification) {
    return NextResponse.json({ error: "Qualification not found" }, { status: 404 });
  }

  await db.$transaction(async (tx) => {
    await tx.studentSubjectGrade.deleteMany({
      where: { qualificationId: qualification.id },
    });

    await tx.studentSubjectGrade.createMany({
      data: payload.data.subjects.map((row) => {
        const matched = matchSubjectName(row.subjectName);
        const rawGrade = (row.rawGrade || "").trim();
        const universalScore = rawGrade
          ? GradeNormaliser.normalise(rawGrade, qualification.qualType)
          : null;

        return {
          qualificationId: qualification.id,
          subjectName: matched.matchedName || row.subjectName.trim(),
          subjectCategory: matched.subjectCategory,
          rawGrade: rawGrade || null,
          gradeType: row.gradeType || "LETTER",
          universalScore,
          ocrConfidence: row.confidence ?? matched.confidence,
          isOcrExtracted: true,
          isConfirmedByStudent: true,
        };
      }),
    });

    await tx.studentQualification.update({
      where: { id: qualification.id },
      data: {
        ocrConfirmedByStudent: true,
        status: "COMPLETED",
      },
    });

    await tx.studentAcademicProfile.update({
      where: { id: qualification.academicProfileId },
      data: {
        isComplete: true,
      },
    });
  });

  const recalculated = await EligibilityMatcher.recalculateForStudentShortlisted(qualification.academicProfile.studentId);

  if (qualification.academicProfile.student.assignedCounsellorId) {
    const studentName = `${qualification.academicProfile.student.firstName} ${qualification.academicProfile.student.lastName}`.trim();
    await NotificationService.createNotification({
      userId: qualification.academicProfile.student.assignedCounsellorId,
      type: "SYSTEM_PROFILE_COMPLETED",
      message: `${studentName} completed their academic profile confirmation.`,
      linkUrl: `/dashboard/students/${qualification.academicProfile.studentId}`,
      actorUserId: session.user.id,
    }).catch(() => undefined);
  }

  return NextResponse.json({
    data: {
      qualificationId: qualification.id,
      confirmedRows: payload.data.subjects.length,
      recalculatedCourses: recalculated.totalCourses,
    },
  });
}
