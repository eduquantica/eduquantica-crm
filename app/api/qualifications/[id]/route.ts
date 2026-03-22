import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { QualType } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { GradeNormaliser } from "@/lib/grade-normalisation";
import { matchSubjectName } from "@/lib/transcript-ocr";
import { EligibilityMatcher } from "@/lib/eligibility-matcher";
import { StudyGapCalculator } from "@/lib/study-gap";

const subjectSchema = z.object({
  subjectName: z.string().min(1),
  rawGrade: z.string().optional(),
  gradeType: z.enum(["GPA", "LETTER"]).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

const LETTER_OPTIONS = new Set(["A*", "A", "A-", "B+", "B", "B-", "C+", "C", "C-"]);

function normaliseGrade(rawGrade: string, gradeType: "GPA" | "LETTER"): string {
  const cleaned = rawGrade.trim().toUpperCase();
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

const patchSchema = z.object({
  qualType: z.nativeEnum(QualType).optional(),
  qualName: z.string().min(1).optional(),
  institutionName: z.string().optional().nullable(),
  countryOfStudy: z.string().optional().nullable(),
  yearCompleted: z.number().int().min(1900).max(2100).optional().nullable(),
  overallGrade: z.string().optional().nullable(),
  fileUrl: z.string().min(1).optional(),
  fileName: z.string().min(1).optional(),
  certificateFileUrl: z.string().min(1).optional(),
  certificateFileName: z.string().min(1).optional(),
  ocrStatus: z.enum(["SKIPPED"]).optional(),
  subjects: z.array(subjectSchema).optional(),
});

function certificatePrefix(qualificationId: string) {
  return `qualification:${qualificationId}: `;
}

function stripCertificatePrefix(qualificationId: string, fileName: string) {
  const prefix = certificatePrefix(qualificationId);
  return fileName.startsWith(prefix) ? fileName.slice(prefix.length) : fileName;
}

function composeInstitution(institutionName?: string | null, countryOfStudy?: string | null): string | null {
  const institution = (institutionName || "").trim();
  const country = (countryOfStudy || "").trim();
  if (!institution && !country) return null;
  if (!country) return institution;
  if (!institution) return country;
  return `${institution} | ${country}`;
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

async function resolveEditableQualification(qualificationId: string, userId: string, roleName?: string) {
  const qualification = await db.studentQualification.findUnique({
    where: { id: qualificationId },
    select: {
      id: true,
      qualType: true,
      academicProfileId: true,
      academicProfile: {
        select: {
          studentId: true,
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

  if (qualification.academicProfile.student.userId === userId) {
    return qualification;
  }

  if (!hasStaffAccess(roleName)) {
    return null;
  }

  if (roleName === "ADMIN" || roleName === "MANAGER") {
    return qualification;
  }

  if (roleName === "COUNSELLOR") {
    return qualification.academicProfile.student.assignedCounsellorId === userId ? qualification : null;
  }

  const [agent, branchStaff] = await Promise.all([
    db.subAgent.findUnique({ where: { userId }, select: { id: true } }),
    db.subAgentStaff.findUnique({ where: { userId }, select: { subAgentId: true } }),
  ]);
  const actorSubAgentId = agent?.id || branchStaff?.subAgentId || null;

  return actorSubAgentId && actorSubAgentId === qualification.academicProfile.student.subAgentId
    ? qualification
    : null;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const payload = patchSchema.safeParse(await req.json());
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
  }

  const qualification = await resolveEditableQualification(params.id, session.user.id, session.user.roleName);
  if (!qualification) {
    return NextResponse.json({ error: "Qualification not found" }, { status: 404 });
  }

  const resolvedQualType = payload.data.qualType || qualification.qualType;

  if (payload.data.subjects) {
    for (const subject of payload.data.subjects) {
      const gradeType = subject.gradeType || "LETTER";
      const raw = (subject.rawGrade || "").trim();
      if (!raw) continue;
      try {
        normaliseGrade(raw, gradeType);
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Invalid subject grade" },
          { status: 400 },
        );
      }
    }
  }

  const updated = await db.$transaction(async (tx) => {
    let transcriptDocId: string | undefined;

    if (payload.data.fileUrl) {
      const transcriptDoc = await tx.document.create({
        data: {
          studentId: qualification.academicProfile.studentId,
          type: "TRANSCRIPT",
          fileName: payload.data.fileName || "Transcript",
          fileUrl: payload.data.fileUrl,
          status: "PENDING",
        },
        select: { id: true },
      });
      transcriptDocId = transcriptDoc.id;
    }

    let createdCertificateDocId: string | undefined;
    if (payload.data.certificateFileUrl) {
      const certificateDoc = await tx.document.create({
        data: {
          studentId: qualification.academicProfile.studentId,
          type: "DEGREE_CERT",
          fileName: `${certificatePrefix(qualification.id)}${payload.data.certificateFileName || "Certificate"}`,
          fileUrl: payload.data.certificateFileUrl,
          status: "PENDING",
        },
        select: { id: true },
      });
      createdCertificateDocId = certificateDoc.id;
    }

    if (payload.data.subjects) {
      await tx.studentSubjectGrade.deleteMany({ where: { qualificationId: qualification.id } });
      await tx.studentSubjectGrade.createMany({
        data: payload.data.subjects.map((subject) => {
          const matched = matchSubjectName(subject.subjectName);
          const gradeType = subject.gradeType || "LETTER";
          const cleanedGrade = (subject.rawGrade || "").trim()
            ? normaliseGrade((subject.rawGrade || "").trim(), gradeType)
            : "";

          return {
            qualificationId: qualification.id,
            subjectName: matched.matchedName || subject.subjectName.trim(),
            subjectCategory: matched.subjectCategory,
            rawGrade: cleanedGrade || null,
            gradeType,
            universalScore: cleanedGrade ? GradeNormaliser.normalise(cleanedGrade, resolvedQualType) : null,
            ocrConfidence: subject.confidence ?? matched.confidence,
            isOcrExtracted: false,
            isConfirmedByStudent: true,
          };
        }),
      });
    }

    await tx.studentQualification.update({
      where: { id: qualification.id },
      data: {
        qualType: payload.data.qualType,
        qualName: payload.data.qualName,
        institutionName:
          payload.data.institutionName !== undefined || payload.data.countryOfStudy !== undefined
            ? composeInstitution(payload.data.institutionName, payload.data.countryOfStudy)
            : undefined,
        yearCompleted: payload.data.yearCompleted,
        overallGrade: payload.data.overallGrade,
        overallUniversal: payload.data.overallGrade
          ? GradeNormaliser.normalise(payload.data.overallGrade, resolvedQualType)
          : null,
        transcriptDocId,
        status: "COMPLETED",
        ocrConfirmedByStudent: payload.data.subjects ? true : undefined,
      },
    });

    await tx.studentAcademicProfile.updateMany({
      where: { studentId: qualification.academicProfile.studentId },
      data: { isComplete: true },
    });

    const reloaded = await tx.studentQualification.findUniqueOrThrow({
      where: { id: qualification.id },
      include: {
        transcriptDoc: {
          select: {
            id: true,
            fileUrl: true,
            fileName: true,
            uploadedAt: true,
          },
        },
        subjects: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    const certificateDocument = createdCertificateDocId
      ? await tx.document.findUnique({
          where: { id: createdCertificateDocId },
          select: {
            id: true,
            fileUrl: true,
            fileName: true,
            uploadedAt: true,
          },
        })
      : await tx.document.findFirst({
          where: {
            studentId: qualification.academicProfile.studentId,
            type: "DEGREE_CERT",
            fileName: {
              startsWith: certificatePrefix(qualification.id),
            },
          },
          orderBy: { uploadedAt: "desc" },
          select: {
            id: true,
            fileUrl: true,
            fileName: true,
            uploadedAt: true,
          },
        });

    return {
      ...reloaded,
      transcriptUrl: reloaded.transcriptDoc?.fileUrl || "",
      transcriptFileName: reloaded.transcriptDoc?.fileName || "",
      transcriptDocumentId: reloaded.transcriptDoc?.id || "",
      transcriptUploadedAt: reloaded.transcriptDoc?.uploadedAt.toISOString() || "",
      certificateUrl: certificateDocument?.fileUrl || "",
      certificateFileName: certificateDocument ? stripCertificatePrefix(qualification.id, certificateDocument.fileName) : "",
      certificateDocumentId: certificateDocument?.id || "",
      certificateUploadedAt: certificateDocument?.uploadedAt.toISOString() || "",
    };
  });

  await EligibilityMatcher.recalculateForStudentShortlisted(qualification.academicProfile.studentId).catch(() => undefined);
  await StudyGapCalculator.recalculateAndHandleAlerts(qualification.academicProfile.studentId).catch(() => undefined);

  return NextResponse.json({ data: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const qualification = await resolveEditableQualification(params.id, session.user.id, session.user.roleName);
  if (!qualification) {
    return NextResponse.json({ error: "Qualification not found" }, { status: 404 });
  }

  await db.$transaction(async (tx) => {
    await tx.studentSubjectGrade.deleteMany({ where: { qualificationId: qualification.id } });
    await tx.studentQualification.delete({ where: { id: qualification.id } });

    const remaining = await tx.studentQualification.count({
      where: { academicProfileId: qualification.academicProfileId },
    });

    if (remaining === 0) {
      await tx.studentAcademicProfile.update({
        where: { id: qualification.academicProfileId },
        data: { isComplete: false },
      });
    }
  });

  await EligibilityMatcher.recalculateForStudentShortlisted(qualification.academicProfile.studentId).catch(() => undefined);
  await StudyGapCalculator.recalculateAndHandleAlerts(qualification.academicProfile.studentId).catch(() => undefined);

  return NextResponse.json({ ok: true });
}
