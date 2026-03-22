import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { QualType } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { EligibilityMatcher } from "@/lib/eligibility-matcher";
import { GradeNormaliser } from "@/lib/grade-normalisation";
import { scanTranscript, matchSubjectName } from "@/lib/transcript-ocr";

const scanSchema = z.object({
  fileUrl: z.string().min(1),
  qualType: z.nativeEnum(QualType),
  qualName: z.string().min(1).optional(),
  yearCompleted: z.number().int().min(1900).max(2100).optional(),
  institutionName: z.string().optional(),
  countryOfStudy: z.string().optional(),
  overallGrade: z.string().optional(),
  transcriptDocId: z.string().optional(),
});

function canScan(roleName?: string): boolean {
  return roleName === "ADMIN" || roleName === "MANAGER" || roleName === "COUNSELLOR";
}

function inferGradeType(rawGrade: string): "GPA" | "LETTER" {
  const cleaned = rawGrade.trim();
  const numeric = Number(cleaned);
  if (!Number.isNaN(numeric) && numeric >= 0 && numeric <= 5) {
    return "GPA";
  }
  return "LETTER";
}

async function setQualificationStatus(id: string, status: "COMPLETED" | "FAILED") {
  await db.$executeRaw`
    UPDATE "StudentQualification"
    SET "status" = CAST(${status} AS "QualificationStatus")
    WHERE "id" = ${id}
  `;
}

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
    select: { id: true, userId: true, firstName: true, lastName: true },
  });

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const isOwner = session.user.id === student.userId;
  if (!isOwner && !canScan(session.user.roleName)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = scanSchema.parse(await req.json());

    let resolvedFileUrl = "";
    try {
      resolvedFileUrl = new URL(payload.fileUrl, req.url).toString();
    } catch {
      return NextResponse.json({ error: "Invalid file URL" }, { status: 400 });
    }

    const profile = await db.studentAcademicProfile.upsert({
      where: { studentId: student.id },
      update: {},
      create: { studentId: student.id },
      select: { id: true },
    });

    const qualification = await db.studentQualification.create({
      data: {
        academicProfileId: profile.id,
        status: "PROCESSING",
        qualType: payload.qualType,
        qualName: payload.qualName || payload.qualType.replaceAll("_", " "),
        yearCompleted: payload.yearCompleted,
        institutionName: payload.countryOfStudy
          ? `${payload.institutionName || ""}${payload.institutionName ? " | " : ""}${payload.countryOfStudy}`
          : payload.institutionName,
        overallGrade: payload.overallGrade,
        transcriptDocId: payload.transcriptDocId,
      } as never,
      select: { id: true, qualType: true },
    });

    const actorUserId = session.user.id;

    const mindeeApiKey = process.env.MINDEE_API_KEY || "";
    if (!mindeeApiKey) {
      await setQualificationStatus(qualification.id, "COMPLETED");

      return NextResponse.json(
        {
          data: {
            qualificationId: qualification.id,
            status: "COMPLETED",
            demoMode: true,
            message: "OCR scanning is not available in demo mode. Please enter your subject grades manually below.",
          },
        },
        { status: 200 },
      );
    }

    void (async () => {
      try {
        const extractedRows = await scanTranscript(resolvedFileUrl, qualification.qualType);

        if (extractedRows.length > 0) {
          await db.studentSubjectGrade.createMany({
            data: extractedRows.map((row) => {
              const matched = matchSubjectName(row.subjectName);
              const universalScore = GradeNormaliser.normalise(row.rawGrade, qualification.qualType);

              return {
                qualificationId: qualification.id,
                subjectName: matched.matchedName || row.subjectName,
                subjectCategory: matched.subjectCategory,
                rawGrade: row.rawGrade,
                gradeType: inferGradeType(row.rawGrade),
                universalScore,
                ocrConfidence: row.confidence,
                isOcrExtracted: true,
                isConfirmedByStudent: false,
              };
            }),
          });
        }

        await setQualificationStatus(qualification.id, "COMPLETED");

        await db.notification.create({
          data: {
            userId: student.userId,
            type: "TRANSCRIPT_SCAN_COMPLETED",
            message: "Your transcript has been scanned. Please review and confirm the results.",
            linkUrl: `/student/profile`,
          },
        });

        await db.activityLog.create({
          data: {
            userId: actorUserId,
            entityType: "StudentQualification",
            entityId: qualification.id,
            action: "transcript_scan_completed",
            details: `OCR rows extracted: ${extractedRows.length}`,
          },
        });

        await EligibilityMatcher.recalculateForStudentShortlisted(student.id);
      } catch (error) {
        console.error("[transcripts/scan background]", error);

        await setQualificationStatus(qualification.id, "FAILED").catch(() => undefined);

        await db.activityLog.create({
          data: {
            userId: actorUserId,
            entityType: "StudentQualification",
            entityId: qualification.id,
            action: "transcript_scan_failed",
            details: error instanceof Error ? error.message : "Unknown scan failure",
          },
        }).catch(() => undefined);
      }
    })();

    return NextResponse.json(
      {
        data: {
          qualificationId: qualification.id,
          status: "PROCESSING",
        },
      },
      { status: 202 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }

    console.error("[/api/students/[id]/transcripts/scan POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
