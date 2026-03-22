import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

function normalizeCode(value?: string | null) {
  return (value || "").trim().toUpperCase();
}

function nationalityAllowed(restrictions: string[], studentNationality?: string | null) {
  if (!restrictions.length) return true;
  const student = normalizeCode(studentNationality);
  if (!student) return false;
  const set = new Set(restrictions.map((item) => normalizeCode(item)));
  return set.has(student);
}

export async function GET(
  _req: Request,
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
      academicProfile: {
        select: {
          isComplete: true,
          qualifications: {
            select: {
              overallUniversal: true,
              subjects: { select: { universalScore: true } },
            },
          },
        },
      },
    },
  });

  if (!student) {
    return NextResponse.json({ error: "Not a student" }, { status: 404 });
  }

  const course = await db.course.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      currency: true,
      universityId: true,
      scholarships: {
        where: { isActive: true },
        orderBy: [{ deadline: "asc" }, { createdAt: "desc" }],
      },
      university: {
        select: {
          id: true,
          name: true,
          country: true,
          currency: true,
        },
      },
    },
  });

  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  const now = new Date();
  const scholarshipIds = course.scholarships
    .filter((scholarship) => !scholarship.deadline || scholarship.deadline >= now)
    .filter((scholarship) => !scholarship.courseId || scholarship.courseId === course.id)
    .filter((scholarship) => nationalityAllowed(scholarship.nationalityRestrictions, student.nationality))
    .map((scholarship) => scholarship.id);

  const applications = await db.studentScholarshipApplication.findMany({
    where: {
      studentId: student.id,
      scholarshipId: { in: scholarshipIds },
    },
    select: {
      id: true,
      scholarshipId: true,
      status: true,
      awardedAmount: true,
    },
  });

  const appByScholarship = new Map(applications.map((row) => [row.scholarshipId, row]));

  const scoreCandidates = (student.academicProfile?.qualifications || [])
    .flatMap((qualification) => {
      if (qualification.overallUniversal != null) return [qualification.overallUniversal];
      return qualification.subjects
        .map((subject) => subject.universalScore)
        .filter((score): score is number => score != null);
    });

  const bestScore = scoreCandidates.length ? Math.max(...scoreCandidates) : null;

  const scholarships = course.scholarships
    .filter((scholarship) => !scholarship.deadline || scholarship.deadline >= now)
    .filter((scholarship) => !scholarship.courseId || scholarship.courseId === course.id)
    .filter((scholarship) => nationalityAllowed(scholarship.nationalityRestrictions, student.nationality))
    .map((scholarship) => {
      const app = appByScholarship.get(scholarship.id) || null;
      return {
        ...scholarship,
        currentStatus: app?.status || null,
        awardedAmount: app?.awardedAmount || null,
        meetsAcademicRequirement:
          scholarship.minAcademicScore == null || bestScore == null
            ? null
            : bestScore >= scholarship.minAcademicScore,
      };
    });

  return NextResponse.json({
    data: {
      course,
      student: {
        id: student.id,
        nationality: student.nationality,
        academicProfileComplete: student.academicProfile?.isComplete || false,
        bestAcademicScore: bestScore,
      },
      scholarships,
    },
  });
}
