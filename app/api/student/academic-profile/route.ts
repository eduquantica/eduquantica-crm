import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

function certificatePrefix(qualificationId: string) {
  return `qualification:${qualificationId}: `;
}

function stripCertificatePrefix(qualificationId: string, fileName: string) {
  const prefix = certificatePrefix(qualificationId);
  return fileName.startsWith(prefix) ? fileName.slice(prefix.length) : fileName;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      academicProfile: {
        include: {
          qualifications: {
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
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });

  if (!student) {
    return NextResponse.json({ error: "Not a student" }, { status: 404 });
  }

  const qualificationIds = student.academicProfile?.qualifications.map((qualification) => qualification.id) || [];
  const certificateDocuments = qualificationIds.length > 0
    ? await db.document.findMany({
        where: {
          studentId: student.id,
          type: "DEGREE_CERT",
          OR: qualificationIds.map((qualificationId) => ({
            fileName: {
              startsWith: certificatePrefix(qualificationId),
            },
          })),
        },
        orderBy: { uploadedAt: "desc" },
        select: {
          id: true,
          fileUrl: true,
          fileName: true,
          uploadedAt: true,
        },
      })
    : [];

  const latestCertificateByQualificationId = new Map<string, typeof certificateDocuments[number]>();
  for (const document of certificateDocuments) {
    const matchedQualificationId = qualificationIds.find((qualificationId) =>
      document.fileName.startsWith(certificatePrefix(qualificationId)),
    );
    if (!matchedQualificationId || latestCertificateByQualificationId.has(matchedQualificationId)) continue;
    latestCertificateByQualificationId.set(matchedQualificationId, document);
  }

  const qualifications = (student.academicProfile?.qualifications || []).map((qualification) => {
    const certificateDocument = latestCertificateByQualificationId.get(qualification.id);
    return {
      ...qualification,
      transcriptUrl: qualification.transcriptDoc?.fileUrl || "",
      transcriptFileName: qualification.transcriptDoc?.fileName || "",
      transcriptDocumentId: qualification.transcriptDoc?.id || "",
      transcriptUploadedAt: qualification.transcriptDoc?.uploadedAt.toISOString() || "",
      certificateUrl: certificateDocument?.fileUrl || "",
      certificateFileName: certificateDocument ? stripCertificatePrefix(qualification.id, certificateDocument.fileName) : "",
      certificateDocumentId: certificateDocument?.id || "",
      certificateUploadedAt: certificateDocument?.uploadedAt.toISOString() || "",
    };
  });

  return NextResponse.json({
    data: {
      studentId: student.id,
      studentName: `${student.firstName || ""} ${student.lastName || ""}`.trim() || "Student",
      academicProfile: student.academicProfile,
      isComplete: student.academicProfile?.isComplete ?? false,
      qualifications,
    },
  });
}
