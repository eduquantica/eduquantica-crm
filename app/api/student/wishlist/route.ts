import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { ApplicationStatus, MatchStatus } from "@prisma/client";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkEligibility } from "@/lib/eligibility/checkEligibility";
import { statusScore, toMatchStatus } from "@/lib/eligibility/presentation";

const payloadSchema = z.object({
  courseId: z.string().min(1),
});

const ACTIVE_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.APPLIED,
  ApplicationStatus.DOCUMENTS_PENDING,
  ApplicationStatus.DOCUMENTS_SUBMITTED,
  ApplicationStatus.SUBMITTED_TO_UNIVERSITY,
  ApplicationStatus.CONDITIONAL_OFFER,
  ApplicationStatus.UNCONDITIONAL_OFFER,
  ApplicationStatus.FINANCE_IN_PROGRESS,
  ApplicationStatus.DEPOSIT_PAID,
  ApplicationStatus.FINANCE_COMPLETE,
  ApplicationStatus.CAS_ISSUED,
  ApplicationStatus.VISA_APPLIED,
  ApplicationStatus.ENROLLED,
];

type IntakeRecord = { date?: string; deadline?: string };

function parseIntakeRecords(input: unknown): IntakeRecord[] {
  if (!Array.isArray(input)) return [];

  const records: IntakeRecord[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const date = typeof row.date === "string" ? row.date : undefined;
    const deadline = typeof row.deadline === "string" ? row.deadline : undefined;
    if (!date && !deadline) continue;
    records.push({ date, deadline });
  }

  return records;
}

function resolveNextIntake(intakes: IntakeRecord[]): IntakeRecord | null {
  if (!intakes.length) return null;

  const now = Date.now();

  const withTime = intakes.map((item) => {
    const candidate = item.deadline || item.date || "";
    const parsed = Date.parse(candidate);
    return {
      ...item,
      ts: Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER,
    };
  });

  const future = withTime
    .filter((item) => item.ts >= now && item.ts < Number.MAX_SAFE_INTEGER)
    .sort((a, b) => a.ts - b.ts);

  if (future.length > 0) return { date: future[0].date, deadline: future[0].deadline };

  const ordered = withTime.sort((a, b) => a.ts - b.ts);
  const first = ordered[0];
  return first ? { date: first.date, deadline: first.deadline } : null;
}

async function getStudentId() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.roleName !== "STUDENT" && session.user.roleName !== "ADMIN") {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    select: { id: true, nationality: true },
  });

  if (!student) {
    return { error: NextResponse.json({ error: "Student profile not found" }, { status: 404 }) } as const;
  }

  return { studentId: student.id, studentNationality: student.nationality } as const;
}

export async function GET(req: Request) {
  const ctx = await getStudentId();
  if ("error" in ctx) return ctx.error;

  const { searchParams } = new URL(req.url);
  const withDetails = searchParams.get("details") === "1";
  const idsFilter = (searchParams.get("ids") || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const rows = await db.studentWishlist.findMany({
    where: {
      studentId: ctx.studentId,
      ...(idsFilter.length > 0 ? { courseId: { in: idsFilter } } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: { courseId: true },
  });

  if (!withDetails) {
    return NextResponse.json({ data: { courseIds: rows.map((row) => row.courseId) } });
  }

  const courseIds = rows.map((row) => row.courseId);

  if (courseIds.length === 0) {
    return NextResponse.json({ data: { courseIds: [], courses: [] } });
  }

  const [courses, activeApplications] = await Promise.all([
    db.course.findMany({
      where: {
        id: { in: courseIds },
      },
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
        intakeDatesWithDeadlines: true,
        entryRequirement: {
          select: {
            englishReqIelts: true,
          },
        },
        university: {
          select: {
            id: true,
            name: true,
            logo: true,
            country: true,
            qsRanking: true,
            timesHigherRanking: true,
            postStudyWorkVisa: true,
          },
        },
        scholarships: {
          where: { isActive: true },
          select: {
            id: true,
            amount: true,
            currency: true,
            amountType: true,
            percentageOf: true,
          },
        },
      },
    }),
    db.application.findMany({
      where: {
        studentId: ctx.studentId,
        courseId: { in: courseIds },
        status: { in: ACTIVE_STATUSES },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        courseId: true,
        status: true,
      },
    }),
  ]);

  const eligibilityRows = await Promise.all(
    courseIds.map(async (courseId) => {
      const eligibility = await checkEligibility(ctx.studentId, courseId);
      return {
        courseId,
        eligibility,
        matchStatus: toMatchStatus(eligibility),
        matchScore: statusScore(eligibility),
      };
    }),
  );

  const eligibilityByCourse = new Map(eligibilityRows.map((row) => [row.courseId, row]));

  const activeAppByCourse = new Map<string, { id: string; status: ApplicationStatus }>();
  for (const application of activeApplications) {
    if (!activeAppByCourse.has(application.courseId)) {
      activeAppByCourse.set(application.courseId, {
        id: application.id,
        status: application.status,
      });
    }
  }

  const courseById = new Map(courses.map((course) => [course.id, course]));
  const orderedCourses = courseIds
    .map((id) => courseById.get(id))
    .filter((course): course is NonNullable<typeof course> => Boolean(course));

  return NextResponse.json({
    data: {
      courseIds,
      studentNationality: ctx.studentNationality,
      courses: orderedCourses.map((course) => {
        const result = eligibilityByCourse.get(course.id);
        const matchStatus = result?.matchStatus ?? MatchStatus.NO_MATCH;
        const matchScore = Math.round(result?.matchScore ?? 0);

        const intakeRecords = parseIntakeRecords(course.intakeDatesWithDeadlines);
        const nextIntake = resolveNextIntake(intakeRecords);

        const scholarshipCount = course.scholarships.length;
        const maxScholarship = course.scholarships.reduce((best, item) => {
          if (!best) return item;
          return item.amount > best.amount ? item : best;
        }, null as (typeof course.scholarships)[number] | null);

        return {
          id: course.id,
          name: course.name,
          level: course.level,
          fieldOfStudy: course.fieldOfStudy,
          duration: course.duration,
          studyMode: course.studyMode,
          tuitionFee: course.tuitionFee,
          applicationFee: course.applicationFee,
          currency: course.currency,
          nextIntake,
          englishReqIelts: course.entryRequirement?.englishReqIelts ?? null,
          university: {
            id: course.university.id,
            name: course.university.name,
            logo: course.university.logo,
            country: course.university.country,
            qsRanking: course.university.qsRanking,
            timesHigherRanking: course.university.timesHigherRanking,
            postStudyWorkVisa: course.university.postStudyWorkVisa,
          },
          scholarshipCount,
          scholarshipAvailable: scholarshipCount > 0,
          scholarshipAmount: maxScholarship
            ? {
                amount: maxScholarship.amount,
                currency: maxScholarship.currency,
                amountType: maxScholarship.amountType,
                percentageOf: maxScholarship.percentageOf,
              }
            : null,
          eligibility: {
            eligible: result?.eligibility.eligible ?? false,
            partiallyEligible: result?.eligibility.partiallyEligible ?? false,
            overridden: result?.eligibility.overridden ?? false,
            overriddenBy: result?.eligibility.overriddenBy,
            overriddenAt: result?.eligibility.overriddenAt ?? undefined,
            matchedRequirements: result?.eligibility.matchedRequirements ?? [],
            missingRequirements: result?.eligibility.missingRequirements ?? [],
            message: result?.eligibility.message || "Add qualifications to check eligibility",
            matchStatus,
            matchScore,
          },
          successChance: Math.max(10, Math.min(95, matchScore)),
          activeApplication: activeAppByCourse.get(course.id) || null,
        };
      }),
    },
  });
}

export async function POST(req: Request) {
  const ctx = await getStudentId();
  if ("error" in ctx) return ctx.error;

  try {
    const payload = payloadSchema.parse(await req.json());

    const course = await db.course.findUnique({
      where: { id: payload.courseId },
      select: { id: true, isActive: true },
    });

    if (!course || !course.isActive) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    await db.studentWishlist.upsert({
      where: {
        studentId_courseId: {
          studentId: ctx.studentId,
          courseId: payload.courseId,
        },
      },
      update: {},
      create: {
        studentId: ctx.studentId,
        courseId: payload.courseId,
      },
    });

    return NextResponse.json({ data: { ok: true } }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }

    console.error("[/api/student/wishlist POST]", error);
    return NextResponse.json({ error: "Failed to update wishlist" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const ctx = await getStudentId();
  if ("error" in ctx) return ctx.error;

  try {
    const payload = payloadSchema.parse(await req.json());

    await db.studentWishlist.deleteMany({
      where: {
        studentId: ctx.studentId,
        courseId: payload.courseId,
      },
    });

    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }

    console.error("[/api/student/wishlist DELETE]", error);
    return NextResponse.json({ error: "Failed to update wishlist" }, { status: 500 });
  }
}
