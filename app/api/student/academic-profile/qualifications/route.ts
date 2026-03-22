import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { QualType } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { StudyGapCalculator } from "@/lib/study-gap";

const createSchema = z.object({
  qualType: z.nativeEnum(QualType),
  qualName: z.string().min(1),
  institutionName: z.string().optional().nullable(),
  countryOfStudy: z.string().optional().nullable(),
  yearCompleted: z.number().int().min(1900).max(2100).optional().nullable(),
  overallGrade: z.string().optional().nullable(),
  fileUrl: z.string().min(1),
  fileName: z.string().min(1),
  certificateFileUrl: z.string().min(1).optional(),
  certificateFileName: z.string().min(1).optional(),
  ocrStatus: z.enum(["SKIPPED"]).optional(),
});

function certificatePrefix(qualificationId: string) {
  return `qualification:${qualificationId}: `;
}

function composeInstitution(institutionName?: string | null, countryOfStudy?: string | null): string | null {
  const institution = (institutionName || "").trim();
  const country = (countryOfStudy || "").trim();
  if (!institution && !country) return null;
  if (!country) return institution;
  if (!institution) return country;
  return `${institution} | ${country}`;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const payload = createSchema.safeParse(await req.json());
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
  }

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const profile = await db.studentAcademicProfile.upsert({
    where: { studentId: student.id },
    update: {},
    create: { studentId: student.id },
    select: { id: true },
  });

  const created = await db.$transaction(async (tx) => {
    const transcriptDoc = await tx.document.create({
      data: {
        studentId: student.id,
        type: "TRANSCRIPT",
        fileName: payload.data.fileName,
        fileUrl: payload.data.fileUrl,
        status: "PENDING",
      },
      select: { id: true },
    });

    const qualification = await tx.studentQualification.create({
      data: {
        academicProfileId: profile.id,
        status: "COMPLETED",
        qualType: payload.data.qualType,
        qualName: payload.data.qualName,
        yearCompleted: payload.data.yearCompleted ?? null,
        institutionName: composeInstitution(payload.data.institutionName, payload.data.countryOfStudy),
        overallGrade: payload.data.overallGrade || null,
        transcriptDocId: transcriptDoc.id,
        ocrConfirmedByStudent: false,
      },
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

    let certificateDoc: { id: string; fileUrl: string; fileName: string; uploadedAt: Date } | null = null;
    if (payload.data.certificateFileUrl) {
      const prefixedCertificateName = `${certificatePrefix(qualification.id)}${payload.data.certificateFileName || "Certificate"}`;
      certificateDoc = await tx.document.create({
        data: {
          studentId: student.id,
          type: "DEGREE_CERT",
          fileName: prefixedCertificateName,
          fileUrl: payload.data.certificateFileUrl,
          status: "PENDING",
        },
        select: {
          id: true,
          fileUrl: true,
          fileName: true,
          uploadedAt: true,
        },
      });
    }

    return {
      ...qualification,
      transcriptUrl: qualification.transcriptDoc?.fileUrl || "",
      transcriptFileName: qualification.transcriptDoc?.fileName || "",
      transcriptDocumentId: qualification.transcriptDoc?.id || "",
      transcriptUploadedAt: qualification.transcriptDoc?.uploadedAt.toISOString() || "",
      certificateUrl: certificateDoc?.fileUrl || "",
      certificateFileName: certificateDoc?.fileName
        ? certificateDoc.fileName.slice(certificatePrefix(qualification.id).length)
        : "",
      certificateDocumentId: certificateDoc?.id || "",
      certificateUploadedAt: certificateDoc?.uploadedAt.toISOString() || "",
    };
  });

  await StudyGapCalculator.recalculateAndHandleAlerts(student.id).catch(() => undefined);

  return NextResponse.json({ data: created }, { status: 201 });
}
