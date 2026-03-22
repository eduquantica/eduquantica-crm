import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import type { Prisma, CourseLevel } from "@prisma/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function staffGuard(session: any) {
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = (session as any).user.roleName;
  if (r === "STUDENT" || r === "SUB_AGENT" || r === "BRANCH_MANAGER" || r === "SUB_AGENT_COUNSELLOR")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

const createCourseSchema = z.object({
  universityId: z.string().min(1),
  name: z.string().min(1),
  level: z.enum(["FOUNDATION", "CERTIFICATE", "DIPLOMA", "BACHELORS", "MASTERS", "PHD"]),
  fieldOfStudy: z.string().min(1),
  duration: z.string().optional(),
  studyMode: z.enum(["FULL_TIME", "PART_TIME", "ONLINE"]).default("FULL_TIME"),
  tuitionFee: z.number().positive().optional(),
  currency: z.string().default("GBP"),
  applicationFee: z.number().positive().optional(),
  tags: z.array(z.enum([
    "FAST_ACCEPTANCE",
    "INSTANT_OFFER",
    "POPULAR",
    "HIGH_JOB_DEMAND",
    "TOP",
    "PRIME",
    "NO_VISA_CAP",
    "LOANS_AVAILABLE"
  ])).default([]),
  description: z.string().optional(),
  curriculum: z.string().optional(),
  intakeDatesWithDeadlines: z.any().optional(), // JSON array of {date, deadline}
  isActive: z.boolean().default(true),
});

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const guard = staffGuard(session);
  if (guard) return guard;

  try {
    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    const country = url.searchParams.get("country");
    const level = url.searchParams.get("level");
    const fieldOfStudy = url.searchParams.get("fieldOfStudy");
    const intakeMonth = url.searchParams.get("intakeMonth");
    const hasScholarship = url.searchParams.get("hasScholarship") === "true";
    const minScholarship = url.searchParams.get("minScholarship") ? parseFloat(url.searchParams.get("minScholarship")!) : 0;
    const fullScholarshipOnly = url.searchParams.get("fullScholarshipOnly") === "true";
    const openForNationality = url.searchParams.get("openForNationality") === "true";
    const scholarshipNationality = (url.searchParams.get("scholarshipNationality") || "").trim().toUpperCase();
    const deadlineNotPassed = url.searchParams.get("deadlineNotPassed") === "true";
    const minFee = url.searchParams.get("minFee") ? parseFloat(url.searchParams.get("minFee")!) : undefined;
    const maxFee = url.searchParams.get("maxFee") ? parseFloat(url.searchParams.get("maxFee")!) : undefined;
    const universityId = url.searchParams.get("universityId");
    const status = url.searchParams.get("status");
    const skip = parseInt(url.searchParams.get("skip") || "0");
    const take = parseInt(url.searchParams.get("take") || "20");


    // build a course where clause
    const where: Prisma.CourseWhereInput = {};

    if (search) {
      where.name = { contains: search, mode: "insensitive" };
    }
    if (level) {
      // cast string to enum type
      where.level = level as CourseLevel;
    }
    if (fieldOfStudy) {
      where.fieldOfStudy = { contains: fieldOfStudy, mode: "insensitive" };
    }
    if (universityId) {
      where.universityId = universityId;
    }
    if (country) {
      where.university = { country };
    }
    if (minFee !== undefined || maxFee !== undefined) {
      where.tuitionFee = {};
      if (minFee !== undefined) where.tuitionFee.gte = minFee;
      if (maxFee !== undefined) where.tuitionFee.lte = maxFee;
    }
    if (status !== null && status !== undefined) {
      where.isActive = status === "active";
    }

    // Will filter by scholarship and intake month in post-processing
    // since they involve related data/JSON

    const courses = await db.course.findMany({
      where,
      skip,
      take,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        level: true,
        fieldOfStudy: true,
        duration: true,
        tuitionFee: true,
        currency: true,
        applicationFee: true,
        tags: true,
        isActive: true,
        intakeDatesWithDeadlines: true,
        universityId: true,
        university: { select: { id: true, name: true, country: true, logo: true } },
        _count: { select: { scholarships: { where: { isActive: true } } } },
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
    });

    // Filter by scholarship if requested
    let filtered = courses;
    if (hasScholarship) {
      filtered = filtered.filter((c) => c._count.scholarships > 0);
    }

    const now = new Date();
    const nationalityAllowed = (restrictions: string[]) => {
      if (!openForNationality) return true;
      if (!scholarshipNationality) return false;
      if (!restrictions.length) return true;
      const normalized = restrictions.map((item) => item.trim().toUpperCase());
      return normalized.includes(scholarshipNationality);
    };

    const usingScholarshipFilters = hasScholarship
      || minScholarship > 0
      || fullScholarshipOnly
      || openForNationality
      || deadlineNotPassed;

    filtered = filtered.filter((course) => {
      const eligibleScholarships = course.scholarships
        .filter((scholarship) => !scholarship.courseId || scholarship.courseId === course.id)
        .filter((scholarship) => !deadlineNotPassed || !scholarship.deadline || scholarship.deadline >= now)
        .filter((scholarship) => !fullScholarshipOnly || !scholarship.isPartial)
        .filter((scholarship) => scholarship.amount >= minScholarship)
        .filter((scholarship) => nationalityAllowed(scholarship.nationalityRestrictions));

      if (usingScholarshipFilters && eligibleScholarships.length === 0) {
        return false;
      }

      return true;
    });

    // Filter by intake month if requested
    interface IntakeObj { date: string; deadline: string; }

    if (intakeMonth) {
      filtered = filtered.filter((c) => {
        if (!c.intakeDatesWithDeadlines || !Array.isArray(c.intakeDatesWithDeadlines)) return false;
        return (c.intakeDatesWithDeadlines as unknown as IntakeObj[]).some((intake) =>
          intake.date && intake.date.startsWith(intakeMonth)
        );
      });
    }

    return NextResponse.json({
      data: {
        courses: filtered.map((c) => ({
          scholarshipPreview: c.scholarships
            .filter((s) => !s.courseId || s.courseId === c.id)
            .filter((s) => !deadlineNotPassed || !s.deadline || s.deadline >= now)
            .sort((a, b) => {
              if (!a.deadline && !b.deadline) return 0;
              if (!a.deadline) return 1;
              if (!b.deadline) return -1;
              return a.deadline.getTime() - b.deadline.getTime();
            })[0] || null,
          id: c.id,
          name: c.name,
          level: c.level,
          fieldOfStudy: c.fieldOfStudy,
          duration: c.duration,
          tuitionFee: c.tuitionFee,
          currency: c.currency,
          applicationFee: c.applicationFee,
          tags: c.tags,
          isActive: c.isActive,
          universityId: c.universityId,
          universityName: c.university.name,
          universityCountry: c.university.country,
          universityLogo: c.university.logo,
          hasScholarship: c._count.scholarships > 0,
          nextIntake: ((c.intakeDatesWithDeadlines as unknown as IntakeObj[]) || [])[0]?.date || null,
        })),
        total: filtered.length,
        page: Math.floor(skip / take) + 1,
        pageSize: take,
      },
    });
  } catch (e) {
    console.error("[/api/admin/courses GET]", e);
    return NextResponse.json(
      {
        error: "Internal server error",
        data: {
          courses: [],
          total: 0,
          page: 1,
          pageSize: 20,
        },
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const guard = staffGuard(session);
  if (guard) return guard;

  try {
    const body = await request.json();
    const parsed = createCourseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    // Verify university exists
    const university = await db.university.findUnique({
      where: { id: parsed.data.universityId },
    });

    if (!university) {
      return NextResponse.json({ error: "University not found" }, { status: 404 });
    }

    // Use university currency if not provided
    const courseData = {
      ...parsed.data,
      currency: parsed.data.currency || university.currency || "GBP",
    };

    const course = await db.course.create({
      data: courseData,
      select: {
        id: true,
        name: true,
        level: true,
        fieldOfStudy: true,
        duration: true,
        tuitionFee: true,
        currency: true,
        applicationFee: true,
        tags: true,
        studyMode: true,
        description: true,
        curriculum: true,
        isActive: true,
        intakeDatesWithDeadlines: true,
        universityId: true,
        university: { select: { id: true, name: true, country: true } },
      },
    });

    // Log activity
    try {
      await db.activityLog.create({
        data: {
          userId: session!.user.id,
          entityType: "course",
          entityId: course.id,
          action: "created",
          details: `Created course: ${course.name} at ${course.university.name}`,
        },
      });
    } catch (err) {
      console.error("Failed to log activity", err);
    }

    return NextResponse.json({ data: { course } }, { status: 201 });
  } catch (e) {
    console.error("[/api/admin/courses POST]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
