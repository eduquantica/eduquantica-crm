import { NextResponse } from "next/server";
import { ApplicationStatus } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkEligibility } from "@/lib/eligibility/checkEligibility";
import { statusScore, toMatchStatus } from "@/lib/eligibility/presentation";

const ACTIVE_APPLICATION_STATUSES: ApplicationStatus[] = [
  "APPLIED",
  "DOCUMENTS_PENDING",
  "DOCUMENTS_SUBMITTED",
  "SUBMITTED_TO_UNIVERSITY",
  "CONDITIONAL_OFFER",
  "UNCONDITIONAL_OFFER",
  "FINANCE_IN_PROGRESS",
  "DEPOSIT_PAID",
  "FINANCE_COMPLETE",
  "CAS_ISSUED",
  "VISA_APPLIED",
  "ENROLLED",
];

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      nationality: true,
      academicProfile: { select: { isComplete: true } },
    },
  });

  if (!student) {
    return NextResponse.json({ error: "Not a student" }, { status: 404 });
  }

  const course = await db.course.findFirst({
    where: { id: params.id, isActive: true },
    select: {
      id: true,
      name: true,
      level: true,
      fieldOfStudy: true,
      duration: true,
      studyMode: true,
      tuitionFee: true,
      applicationFee: true,
      currency: true,
      tags: true,
      description: true,
      curriculum: true,
      intakeDatesWithDeadlines: true,
      totalEnrolledStudents: true,
      completionRate: true,
      universityId: true,
      university: {
        select: {
          id: true,
          name: true,
          country: true,
          city: true,
          website: true,
          currency: true,
        },
      },
      _count: {
        select: {
          scholarships: { where: { isActive: true } },
        },
      },
    },
  });

  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  const similarProgramConditions = [
    { universityId: course.universityId },
    { level: course.level },
    ...(course.fieldOfStudy ? [{ fieldOfStudy: course.fieldOfStudy }] : []),
  ];

  const [eligibility, wishlisted, activeApplication, similarPrograms] = await Promise.all([
    checkEligibility(student.id, course.id),
    db.studentWishlist.findUnique({
      where: {
        studentId_courseId: {
          studentId: student.id,
          courseId: course.id,
        },
      },
      select: { id: true },
    }),
    db.application.findFirst({
      where: {
        studentId: student.id,
        courseId: course.id,
        status: { in: ACTIVE_APPLICATION_STATUSES },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
      },
    }),
    db.course.findMany({
      where: {
        isActive: true,
        id: { not: course.id },
        OR: similarProgramConditions,
      },
      take: 6,
      select: {
        id: true,
        name: true,
        level: true,
        fieldOfStudy: true,
        tuitionFee: true,
        currency: true,
        university: {
          select: {
            name: true,
            country: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
    }),
  ]);

  return NextResponse.json({
    data: {
      course: {
        ...course,
        activeScholarships: course._count.scholarships,
        _count: undefined,
      },
      student: {
        id: student.id,
        nationality: student.nationality,
        academicProfileComplete: student.academicProfile?.isComplete ?? false,
      },
      eligibility: eligibility
        ? {
            ...eligibility,
            matchStatus: toMatchStatus(eligibility),
            matchScore: statusScore(eligibility),
          }
        : {
            eligible: false,
            partiallyEligible: false,
            overridden: false,
            matchedRequirements: [],
            missingRequirements: [],
            message: "Add qualifications to check eligibility",
            matchStatus: "PENDING",
            matchScore: 0,
          },
      isWishlisted: Boolean(wishlisted),
      activeApplication,
      similarPrograms: similarPrograms.sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name)),
    },
  });
}
