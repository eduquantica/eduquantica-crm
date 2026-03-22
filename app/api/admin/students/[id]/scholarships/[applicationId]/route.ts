import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

function canAccess(roleName?: string) {
  return roleName === "ADMIN" || roleName === "MANAGER" || roleName === "COUNSELLOR";
}

const patchSchema = z.object({
  status: z.enum(["SHORTLISTED", "AWARDED", "REJECTED", "APPLIED", "INTERESTED"]).optional(),
  counsellorNote: z.string().nullable().optional(),
  awardedAmount: z.number().nonnegative().nullable().optional(),
  awardLetterUrl: z.string().nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; applicationId: string } },
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

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
  }

  const existing = await db.studentScholarshipApplication.findFirst({
    where: { id: params.applicationId, studentId: params.id },
    select: { id: true, status: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Scholarship tracker item not found" }, { status: 404 });
  }

  const data = {
    status: parsed.data.status,
    counsellorNote: parsed.data.counsellorNote === undefined ? undefined : parsed.data.counsellorNote || null,
    awardedAmount: parsed.data.awardedAmount === undefined ? undefined : parsed.data.awardedAmount,
    awardLetterUrl: parsed.data.awardLetterUrl === undefined ? undefined : parsed.data.awardLetterUrl || null,
    appliedAt:
      parsed.data.status === "APPLIED" && existing.status !== "APPLIED"
        ? new Date()
        : undefined,
  };

  if ((parsed.data.status || existing.status) === "AWARDED" && (data.awardedAmount == null)) {
    return NextResponse.json({ error: "Awarded amount is required when status is AWARDED" }, { status: 400 });
  }

  const row = await db.studentScholarshipApplication.update({
    where: { id: existing.id },
    data,
  });

  await db.activityLog.create({
    data: {
      userId: session.user.id,
      entityType: "StudentScholarshipApplication",
      entityId: row.id,
      action: "counsellor_scholarship_status_updated",
      details: `Updated status to ${row.status}`,
    },
  });

  return NextResponse.json({ data: row });
}
