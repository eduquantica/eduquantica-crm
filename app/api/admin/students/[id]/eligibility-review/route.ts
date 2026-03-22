import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkEligibility } from "@/lib/eligibility/checkEligibility";
import { statusScore, toMatchStatus } from "@/lib/eligibility/presentation";

function canAccessEligibilityTools(roleName?: string): boolean {
  return ["COUNSELLOR", "ADMIN", "MANAGER", "SUB_AGENT", "BRANCH_MANAGER", "SUB_AGENT_COUNSELLOR"].includes(roleName || "");
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

  const student = await db.student.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      userId: true,
      assignedCounsellorId: true,
      firstName: true,
      lastName: true,
      nationality: true,
      academicProfile: {
        select: {
          isComplete: true,
          qualifications: {
            include: {
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
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  if (session.user.roleName === "COUNSELLOR" && student.assignedCounsellorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [courses, savedResults, applications, overrides] = await Promise.all([
    db.course.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        level: true,
        fieldOfStudy: true,
        tuitionFee: true,
        currency: true,
        university: {
          select: {
            id: true,
            name: true,
            country: true,
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    db.courseEligibilityResult.findMany({
      where: { studentId: student.id },
      select: {
        courseId: true,
        counsellorFlagNote: true,
      },
    }),
    db.application.findMany({
      where: { studentId: student.id },
      select: { id: true, courseId: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    db.eligibilityOverride.findMany({
      where: { studentId: student.id },
      select: {
        courseId: true,
        overriddenByName: true,
        createdAt: true,
      },
    }),
  ]);

  const eligibilityRows = await Promise.all(
    courses.map(async (course) => {
      const eligibility = await checkEligibility(student.id, course.id);
      return {
        course,
        eligibility,
        matchStatus: toMatchStatus(eligibility),
        matchScore: statusScore(eligibility),
      };
    }),
  );

  eligibilityRows.sort((a, b) => b.matchScore - a.matchScore);

  const noteByCourse = new Map(savedResults.map((row) => [row.courseId, row.counsellorFlagNote]));
  const overrideByCourse = new Map(overrides.map((row) => [row.courseId, row]));

  const appByCourse = new Map<string, (typeof applications)[number]>();
  for (const application of applications) {
    if (!appByCourse.has(application.courseId)) {
      appByCourse.set(application.courseId, application);
    }
  }

  const matches = eligibilityRows.map((row) => {
    const application = appByCourse.get(row.course.id);
    const override = overrideByCourse.get(row.course.id);
    const missingSubjects = row.eligibility.missingRequirements
      .filter((item) => item.toLowerCase().includes("missing subject"))
      .map((item) => item.replace(/^missing subject:\s*/i, "").trim());
    const weakSubjects = row.eligibility.missingRequirements
      .filter((item) => item.toLowerCase().includes("weak subject"))
      .map((item) => item.replace(/^weak subject score:\s*/i, "").trim());

    return {
      courseId: row.course.id,
      matchStatus: row.matchStatus,
      matchScore: row.matchScore,
      overallMet: row.eligibility.eligible || row.eligibility.partiallyEligible,
      overridden: Boolean(override),
      overriddenByName: override?.overriddenByName || null,
      overriddenAt: override?.createdAt?.toISOString() || null,
      englishMet: null,
      missingSubjects,
      weakSubjects,
      counsellorFlagNote: noteByCourse.get(row.course.id) || null,
      course: row.course,
      hasApplication: !!application,
      applicationId: application?.id || null,
      applicationStatus: application?.status || null,
    };
  });

  return NextResponse.json({
    data: {
      student: {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        nationality: student.nationality,
      },
      academicProfileComplete: student.academicProfile?.isComplete ?? false,
      qualifications: student.academicProfile?.qualifications ?? [],
      matches,
    },
  });
}
