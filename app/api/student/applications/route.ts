import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.roleName !== "STUDENT" && session.user.roleName !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const student = await db.student.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    if (!student) {
      return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
    }

    const applications = await db.application.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        visaSubStatus: true,
        createdAt: true,
        submittedAt: true,
        offerReceivedAt: true,
        course: {
          select: {
            id: true,
            name: true,
            intakeDatesWithDeadlines: true,
            university: {
              select: {
                id: true,
                name: true,
                logo: true,
                country: true,
              },
            },
          },
        },
      },
    });

    const data = applications.map((application) => {
      const intake = Array.isArray(application.course.intakeDatesWithDeadlines)
        ? (application.course.intakeDatesWithDeadlines as Array<{ date?: string; deadline?: string }>)[0] || null
        : null;

      return {
        id: application.id,
        status: application.status,
        visaSubStatus: application.visaSubStatus,
        createdAt: application.createdAt,
        submittedAt: application.submittedAt,
        offerReceivedAt: application.offerReceivedAt,
        intake,
        course: {
          id: application.course.id,
          name: application.course.name,
        },
        university: application.course.university,
      };
    });

    return NextResponse.json({ data });
  } catch (error) {
    console.error("[/api/student/applications GET]", error);
    return NextResponse.json({ error: "Failed to load applications", data: [] }, { status: 500 });
  }
}
