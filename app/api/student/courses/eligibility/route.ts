import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { MatchStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkEligibility } from "@/lib/eligibility/checkEligibility";
import { statusOrder, statusScore, toMatchStatus } from "@/lib/eligibility/presentation";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const url = new URL(req.url);
  const showAll = url.searchParams.get("showAll") === "1";
  const scholarshipOnly = url.searchParams.get("scholarshipOnly") === "1";
  const minScholarship = Number(url.searchParams.get("minScholarship") || "0") || 0;
  const fullScholarshipOnly = url.searchParams.get("fullScholarshipOnly") === "1";
  const openForNationality = url.searchParams.get("openForNationality") === "1";
  const deadlineNotPassed = url.searchParams.get("deadlineNotPassed") === "1";

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      nationality: true,
      academicProfile: {
        select: {
          isComplete: true,
        },
      },
    },
  });

  if (!student) {
    return NextResponse.json({ error: "Not a student" }, { status: 404 });
  }

  const courses = await db.course.findMany({
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
      scholarships: {
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          amount: true,
          amountType: true,
          isPartial: true,
          deadline: true,
          nationalityRestrictions: true,
          courseId: true,
        },
        orderBy: [{ deadline: "asc" }, { createdAt: "desc" }],
      },
    },
    orderBy: { name: "asc" },
  });

  const eligibilityRows = await Promise.all(
    courses.map(async (course) => {
      const eligibility = await checkEligibility(student.id, course.id);
      return {
        courseId: course.id,
        eligibility,
        matchStatus: toMatchStatus(eligibility),
        matchScore: statusScore(eligibility),
      };
    }),
  );

  const resultMap = new Map(eligibilityRows.map((result) => [result.courseId, result]));

  const now = new Date();
  const nationalityAllowed = (restrictions: string[]) => {
    if (!openForNationality) return true;
    if (!student.nationality) return false;
    if (!restrictions.length) return true;
    const normalized = restrictions.map((item) => item.trim().toUpperCase());
    return normalized.includes(student.nationality.trim().toUpperCase());
  };

  let feed = courses.map((course) => {
    const eligibleScholarships = course.scholarships
      .filter((scholarship) => !scholarship.courseId || scholarship.courseId === course.id)
      .filter((scholarship) => !deadlineNotPassed || !scholarship.deadline || scholarship.deadline >= now)
      .filter((scholarship) => !fullScholarshipOnly || !scholarship.isPartial)
      .filter((scholarship) => scholarship.amount >= minScholarship)
      .filter((scholarship) => nationalityAllowed(scholarship.nationalityRestrictions));

    const result = resultMap.get(course.id);
    return {
      ...course,
      matchStatus: result?.matchStatus ?? MatchStatus.NO_MATCH,
      matchScore: result?.matchScore ?? 0,
      eligibility: result?.eligibility || {
        eligible: false,
        partiallyEligible: false,
        overridden: false,
        matchedRequirements: [],
        missingRequirements: [],
        message: "Add qualifications to check eligibility",
      },
      scholarshipCount: eligibleScholarships.length,
      scholarshipPreview: eligibleScholarships[0] || null,
    };
  });

  if (!showAll) {
    feed = feed.filter((item) => item.matchStatus !== MatchStatus.NO_MATCH);
  }

  if (scholarshipOnly || minScholarship > 0 || fullScholarshipOnly || openForNationality) {
    feed = feed.filter((item) => item.scholarshipCount > 0);
  }

  feed.sort((a, b) => {
    const statusDiff = statusOrder(a.matchStatus) - statusOrder(b.matchStatus);
    if (statusDiff !== 0) return statusDiff;
    return (b.matchScore ?? 0) - (a.matchScore ?? 0);
  });

  return NextResponse.json({
    data: {
      academicProfileComplete: student.academicProfile?.isComplete ?? false,
      courses: feed,
    },
  });
}
