import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { autoImportCvFromStudentData, getCvAutoImportPreview } from "@/lib/cv-auto-import";

async function resolveStudentId(userId: string) {
  const student = await db.student.findUnique({
    where: { userId },
    select: { id: true },
  });
  return student?.id || null;
}

export async function GET(request: NextRequest) {
  void request;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const studentId = await resolveStudentId(session.user.id);
  if (!studentId) {
    return NextResponse.json({ data: { qualificationCount: 0, languageHint: null, workExperienceCount: 0 } });
  }

  const preview = await getCvAutoImportPreview(studentId);
  return NextResponse.json({ data: preview });
}

export async function POST(request: NextRequest) {
  void request;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const studentId = await resolveStudentId(session.user.id);
  if (!studentId) return NextResponse.json({ error: "Student profile not found" }, { status: 404 });

  const profile = await db.cvProfile.upsert({
    where: { userId: session.user.id },
    update: { studentId },
    create: {
      userId: session.user.id,
      studentId,
      templateStyle: "modern",
    },
    select: { id: true },
  });

  const result = await autoImportCvFromStudentData({
    studentId,
    userId: session.user.id,
    cvProfileId: profile.id,
  });

  return NextResponse.json({ data: result });
}
