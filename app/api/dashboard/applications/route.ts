import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { normalizeCountryCode } from "@/lib/financial-requirements";
import { ApplicationStatus } from "@prisma/client";
import { z } from "zod";
import { ensureFeePaymentForApplication, getApplicationFeeSummary } from "@/lib/application-fees";

const createApplicationSchema = z.object({
  studentId: z.string().min(1),
  courseId: z.string().min(1),
  universityId: z.string().min(1),
  intake: z.string().min(1),
  counsellorId: z.string().optional().nullable(),
  isUcas: z.boolean().optional(),
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

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user with role
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      include: { role: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const counsellorId = searchParams.get("counsellorId");
    const subAgentId = searchParams.get("subAgentId");
    const studentId = searchParams.get("studentId");
    const intakeMonth = searchParams.get("intakeMonth");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const searchQuery = searchParams.get("search");

    // Build filters
    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (counsellorId) {
      where.counsellorId = counsellorId;
    }

    if (studentId) {
      where.studentId = studentId;
    }

    // Filter by subAgent through student
    if (subAgentId) {
      where.student = {
        subAgentId: subAgentId,
      };
    }

    // Date range filter
    if (dateFrom || dateTo) {
      where.createdAt = {} as Record<string, Date>;
      if (dateFrom) {
        (where.createdAt as Record<string, Date>).gte = new Date(dateFrom);
      }
      if (dateTo) {
        (where.createdAt as Record<string, Date>).lte = new Date(dateTo);
      }
    }

    // Search filter (student name, university name, or application ID)
    if (searchQuery) {
      where.OR = [
        {
          student: {
            firstName: { contains: searchQuery, mode: "insensitive" },
          },
        },
        {
          student: {
            lastName: { contains: searchQuery, mode: "insensitive" },
          },
        },
        {
          university: {
            name: { contains: searchQuery, mode: "insensitive" },
          },
        },
        {
          id: { contains: searchQuery, mode: "insensitive" },
        },
      ];
    }

    if (intakeMonth) {
      const [yearRaw, monthRaw] = intakeMonth.split("-");
      const year = Number(yearRaw);
      const month = Number(monthRaw);
      if (Number.isFinite(year) && Number.isFinite(month) && month >= 1 && month <= 12) {
        const start = new Date(Date.UTC(year, month - 1, 1));
        const end = new Date(Date.UTC(year, month, 1));
        where.intake = {
          gte: start.toISOString(),
          lt: end.toISOString(),
        };
      }
    }

    // Check user role for permission filtering
    const isCounsellor = user.role.name === "COUNSELLOR";

    // If counsellor, only show applications for their assigned students
    if (isCounsellor) {
      where.student = {
        ...(where.student as Record<string, unknown> || {}),
        assignedCounsellorId: user.id,
      };
    }

    // Fetch applications
    const applications = await db.application.findMany({
      where,
      include: {
        student: {
          include: {
            subAgent: true,
          },
        },
        course: {
          include: {
            university: true,
          },
        },
        counsellor: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Process intake dates
    const latestCountryUpdates = await db.immigrationRuleChangelog.findMany({
      where: {
        alert: { status: "CONFIRMED_PUBLISHED" },
      },
      orderBy: { createdAt: "desc" },
      select: { country: true, createdAt: true },
    });

    const countryUpdateMap = new Map<string, Date>();
    for (const row of latestCountryUpdates) {
      const key = normalizeCountryCode(row.country);
      if (!countryUpdateMap.has(key)) {
        countryUpdateMap.set(key, row.createdAt);
      }
    }

    const applicationsWithIntake = await Promise.all(applications.map(async (app) => {
      const intakeDates = app.course.intakeDatesWithDeadlines
        ? (app.course.intakeDatesWithDeadlines as Array<{ date?: string }>)
        : [];
      const nextIntake = intakeDates[0]?.date || null;
      const countryCode = normalizeCountryCode(app.course.university.country);
      const latestUpdateAt = countryUpdateMap.get(countryCode) || null;
      const hasImmigrationUpdate = Boolean(latestUpdateAt && latestUpdateAt > app.createdAt);
      const fee = await getApplicationFeeSummary(app.id);

      return {
        ...app,
        nextIntake,
        hasImmigrationUpdate,
        fee,
      };
    }));

    return NextResponse.json({
      data: applicationsWithIntake,
      count: applicationsWithIntake.length,
    });
  } catch (error) {
    console.error("Error fetching applications:", error);
    return NextResponse.json(
      { error: "Internal server error", data: [], count: 0 },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { email: session.user.email },
      include: { role: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const parsed = createApplicationSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }

    const { studentId, courseId, universityId, intake, counsellorId, isUcas } = parsed.data;

    const course = await db.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        universityId: true,
        isActive: true,
        level: true,
      },
    });

    if (!course || !course.isActive) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    if (course.universityId !== universityId) {
      return NextResponse.json({ error: "Course does not belong to selected university" }, { status: 400 });
    }

    const existing = await db.application.findFirst({
      where: {
        studentId,
        courseId,
        status: { in: ACTIVE_STATUSES },
      },
      select: {
        id: true,
        status: true,
      },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      return NextResponse.json(
        {
          error: "An active application already exists for this student and course.",
          existingApplicationId: existing.id,
        },
        { status: 409 },
      );
    }

    const requestedUcas = Boolean(isUcas);
    const level = (course.level || "").toLowerCase();
    const isUndergraduate = level.includes("undergraduate") || level.startsWith("ug");
    const applyUcas = requestedUcas && isUndergraduate;

    const created = await db.application.create({
      data: {
        studentId,
        courseId,
        universityId,
        counsellorId: counsellorId || null,
        intake: intake,
        status: "APPLIED",
        isUcas: applyUcas,
      },
    });

    await ensureFeePaymentForApplication(created.id);
    const fee = await getApplicationFeeSummary(created.id);

    // Log activity
    await db.activityLog.create({
      data: {
        userId: user.id,
        entityType: "application",
        entityId: created.id,
        action: "created_application",
        details: `Created application for student ${studentId}`,
      },
    });

    return NextResponse.json(
      {
        data: {
          ...created,
          fee,
          ucasWarning: requestedUcas && !isUndergraduate
            ? "UCAS fee applies to undergraduate applications only"
            : null,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating application:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
