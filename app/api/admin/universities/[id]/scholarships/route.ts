import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

function canManageScholarships(roleName?: string) {
  return roleName === "ADMIN" || roleName === "MANAGER";
}

function canViewScholarships(roleName?: string) {
  return roleName === "ADMIN" || roleName === "MANAGER" || roleName === "COUNSELLOR";
}

const schema = z.object({
  name: z.string().min(1),
  courseId: z.string().nullable().optional(),
  amountType: z.enum(["FIXED", "PERCENTAGE"]),
  amount: z.number().positive(),
  percentageOf: z.enum(["TUITION", "LIVING", "TOTAL"]).nullable().optional(),
  isPartial: z.boolean().default(false),
  deadline: z.string().nullable().optional(),
  intakePeriod: z.string().nullable().optional(),
  eligibilityCriteria: z.string().min(1),
  nationalityRestrictions: z.array(z.string()).default([]),
  minAcademicScore: z.number().min(0).max(100).nullable().optional(),
  minEnglishScore: z.number().min(0).max(9).nullable().optional(),
  isAutoRenewable: z.boolean().default(false),
  applicationProcess: z.string().nullable().optional(),
  externalUrl: z.string().url().nullable().optional(),
  isActive: z.boolean().default(true),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  if (!canViewScholarships(session.user.roleName)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const scholarships = await db.scholarship.findMany({
    where: { universityId: params.id },
    include: {
      course: {
        select: {
          id: true,
          name: true,
        },
      },
      _count: {
        select: {
          applications: true,
        },
      },
    },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ data: scholarships });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  if (!canManageScholarships(session.user.roleName)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
  }

  const payload = parsed.data;

  if (payload.amountType === "PERCENTAGE" && !payload.percentageOf) {
    return NextResponse.json({ error: "percentageOf is required for percentage scholarships" }, { status: 400 });
  }

  if (payload.amountType === "FIXED" && payload.percentageOf) {
    return NextResponse.json({ error: "percentageOf is only valid for percentage scholarships" }, { status: 400 });
  }

  const university = await db.university.findUnique({
    where: { id: params.id },
    select: { id: true, currency: true },
  });

  if (!university) {
    return NextResponse.json({ error: "University not found" }, { status: 404 });
  }

  if (payload.courseId) {
    const course = await db.course.findFirst({
      where: { id: payload.courseId, universityId: params.id },
      select: { id: true },
    });

    if (!course) {
      return NextResponse.json({ error: "Selected course does not belong to this university" }, { status: 400 });
    }
  }

  const scholarship = await db.scholarship.create({
    data: {
      universityId: params.id,
      courseId: payload.courseId || null,
      name: payload.name,
      amountType: payload.amountType,
      amount: payload.amount,
      percentageOf: payload.amountType === "PERCENTAGE" ? payload.percentageOf || null : null,
      isPartial: payload.isPartial,
      deadline: payload.deadline ? new Date(payload.deadline) : null,
      intakePeriod: payload.intakePeriod || null,
      eligibilityCriteria: payload.eligibilityCriteria,
      nationalityRestrictions: payload.nationalityRestrictions,
      minAcademicScore: payload.minAcademicScore ?? null,
      minEnglishScore: payload.minEnglishScore ?? null,
      isAutoRenewable: payload.isAutoRenewable,
      applicationProcess: payload.applicationProcess || null,
      externalUrl: payload.externalUrl || null,
      isActive: payload.isActive,
      currency: university.currency,
    },
    include: {
      course: { select: { id: true, name: true } },
      _count: { select: { applications: true } },
    },
  });

  await db.activityLog.create({
    data: {
      userId: session.user.id,
      entityType: "Scholarship",
      entityId: scholarship.id,
      action: "scholarship_created",
      details: `Created scholarship ${scholarship.name}`,
    },
  });

  return NextResponse.json({ data: scholarship }, { status: 201 });
}
