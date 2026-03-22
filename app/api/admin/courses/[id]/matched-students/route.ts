import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

function canAccessEligibilityTools(roleName?: string): boolean {
  return roleName === "COUNSELLOR" || roleName === "ADMIN" || roleName === "MANAGER";
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  if (!canAccessEligibilityTools(session.user.roleName)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const results = await db.courseEligibilityResult.findMany({
    where: {
      courseId: params.id,
      matchStatus: { in: ["PENDING", "FULL_MATCH", "PARTIAL_MATCH"] },
    },
    select: {
      id: true,
      studentId: true,
      matchStatus: true,
      matchScore: true,
      missingSubjects: true,
      weakSubjects: true,
      englishMet: true,
      overallMet: true,
      counsellorFlagNote: true,
      calculatedAt: true,
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          nationality: true,
          assignedCounsellor: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: [
      { matchScore: "desc" },
      { calculatedAt: "desc" },
    ],
  });

  const applications = await db.application.findMany({
    where: { courseId: params.id },
    select: {
      id: true,
      studentId: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const appByStudent = new Map<string, (typeof applications)[number]>();
  for (const application of applications) {
    if (!appByStudent.has(application.studentId)) {
      appByStudent.set(application.studentId, application);
    }
  }

  const students = results.map((result) => {
    const application = appByStudent.get(result.studentId);
    return {
      ...result,
      hasApplication: !!application,
      applicationId: application?.id || null,
      applicationStatus: application?.status || null,
    };
  });

  return NextResponse.json({ data: students });
}
