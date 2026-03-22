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

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
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
    include: {
      academicProfile: {
        select: {
          studentId: true,
        },
      },
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

  if (!qualification) {
    return NextResponse.json({ error: "Qualification not found" }, { status: 404 });
  }

  const certificateDocument = await db.document.findFirst({
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

  const payload = {
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

  return NextResponse.json({ data: payload });
}
