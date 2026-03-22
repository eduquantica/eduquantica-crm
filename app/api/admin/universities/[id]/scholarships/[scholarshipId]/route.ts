import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

function canManageScholarships(roleName?: string) {
  return roleName === "ADMIN" || roleName === "MANAGER";
}

const schema = z.object({
  name: z.string().min(1).optional(),
  courseId: z.string().nullable().optional(),
  amountType: z.enum(["FIXED", "PERCENTAGE"]).optional(),
  amount: z.number().positive().optional(),
  percentageOf: z.enum(["TUITION", "LIVING", "TOTAL"]).nullable().optional(),
  isPartial: z.boolean().optional(),
  deadline: z.string().nullable().optional(),
  intakePeriod: z.string().nullable().optional(),
  eligibilityCriteria: z.string().min(1).optional(),
  nationalityRestrictions: z.array(z.string()).optional(),
  minAcademicScore: z.number().min(0).max(100).nullable().optional(),
  minEnglishScore: z.number().min(0).max(9).nullable().optional(),
  isAutoRenewable: z.boolean().optional(),
  applicationProcess: z.string().nullable().optional(),
  externalUrl: z.string().url().nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; scholarshipId: string } },
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

  const existing = await db.scholarship.findFirst({
    where: { id: params.scholarshipId, universityId: params.id },
    select: { id: true, amountType: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Scholarship not found" }, { status: 404 });
  }

  const payload = parsed.data;
  const nextType = payload.amountType || existing.amountType;
  if (nextType === "PERCENTAGE" && payload.percentageOf === undefined) {
    const current = await db.scholarship.findUnique({
      where: { id: params.scholarshipId },
      select: { percentageOf: true },
    });
    if (!current?.percentageOf) {
      return NextResponse.json({ error: "percentageOf is required for percentage scholarships" }, { status: 400 });
    }
  }

  const data = {
    ...payload,
    deadline: payload.deadline === undefined ? undefined : payload.deadline ? new Date(payload.deadline) : null,
    intakePeriod: payload.intakePeriod === undefined ? undefined : payload.intakePeriod || null,
    applicationProcess: payload.applicationProcess === undefined ? undefined : payload.applicationProcess || null,
    externalUrl: payload.externalUrl === undefined ? undefined : payload.externalUrl || null,
    percentageOf:
      nextType === "PERCENTAGE"
        ? (payload.percentageOf === undefined ? undefined : payload.percentageOf)
        : null,
  };

  const scholarship = await db.scholarship.update({
    where: { id: params.scholarshipId },
    data,
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
      action: "scholarship_updated",
      details: `Updated scholarship ${scholarship.name}`,
    },
  });

  return NextResponse.json({ data: scholarship });
}
