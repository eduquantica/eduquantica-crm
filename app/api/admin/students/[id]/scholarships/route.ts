import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

function canAccess(roleName?: string) {
  return roleName === "ADMIN" || roleName === "MANAGER" || roleName === "COUNSELLOR";
}

const addSchema = z.object({
  scholarshipId: z.string().min(1),
  status: z.enum(["INTERESTED", "APPLIED", "SHORTLISTED", "AWARDED", "REJECTED"]).default("INTERESTED"),
  notes: z.string().nullable().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!canAccess(session.user.roleName)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const student = await db.student.findUnique({
    where: { id: params.id },
    select: { id: true, assignedCounsellorId: true },
  });
  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });
  if (session.user.roleName === "COUNSELLOR" && student.assignedCounsellorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await db.studentScholarshipApplication.findMany({
    where: { studentId: student.id },
    include: {
      scholarship: {
        include: {
          university: { select: { id: true, name: true } },
          course: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  const availableScholarships = await db.scholarship.findMany({
    where: {
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      university: { select: { name: true } },
      course: { select: { name: true } },
      deadline: true,
      amount: true,
      amountType: true,
      currency: true,
    },
    orderBy: [{ createdAt: "desc" }],
    take: 500,
  });

  return NextResponse.json({ data: { rows, availableScholarships } });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!canAccess(session.user.roleName)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const student = await db.student.findUnique({
    where: { id: params.id },
    select: { id: true, assignedCounsellorId: true },
  });
  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });
  if (session.user.roleName === "COUNSELLOR" && student.assignedCounsellorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = addSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
  }

  const scholarship = await db.scholarship.findUnique({ where: { id: parsed.data.scholarshipId }, select: { id: true } });
  if (!scholarship) return NextResponse.json({ error: "Scholarship not found" }, { status: 404 });

  const existing = await db.studentScholarshipApplication.findFirst({
    where: { studentId: student.id, scholarshipId: scholarship.id },
    select: { id: true },
  });

  const row = existing
    ? await db.studentScholarshipApplication.update({
        where: { id: existing.id },
        data: {
          status: parsed.data.status,
          notes: parsed.data.notes || null,
        },
      })
    : await db.studentScholarshipApplication.create({
        data: {
          studentId: student.id,
          scholarshipId: scholarship.id,
          status: parsed.data.status,
          notes: parsed.data.notes || null,
          appliedAt: parsed.data.status === "APPLIED" ? new Date() : null,
        },
      });

  return NextResponse.json({ data: row }, { status: existing ? 200 : 201 });
}
