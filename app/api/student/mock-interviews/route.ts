import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.roleName !== "STUDENT" && session.user.roleName !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!student) return NextResponse.json({ error: "Student profile not found" }, { status: 404 });

  const rows = await db.mockInterview.findMany({
    where: { studentId: student.id },
    include: {
      application: {
        select: {
          id: true,
          course: { select: { name: true, university: { select: { name: true, country: true } } } },
        },
      },
      report: {
        select: {
          overallScore: true,
          isPassed: true,
          recommendation: true,
          generatedAt: true,
        },
      },
    },
    orderBy: [{ assignedAt: "desc" }],
  });

  return NextResponse.json({
    data: rows.map((row) => ({
      id: row.id,
      applicationId: row.applicationId,
      interviewType: row.interviewType,
      status: row.status,
      assignedAt: row.assignedAt,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      attemptNumber: row.attemptNumber,
      overallScore: row.overallScore,
      recommendation: row.recommendation,
      passingScore: row.passingScore,
      university: row.application.course.university.name,
      course: row.application.course.name,
      country: row.application.course.university.country,
      report: row.report,
    })),
  });
}
