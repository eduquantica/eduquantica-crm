import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({
  scholarshipId: z.string().min(1),
  status: z.enum(["INTERESTED", "APPLIED"]),
  applicationId: z.string().min(1).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      assignedCounsellorId: true,
    },
  });

  if (!student) {
    return NextResponse.json({ error: "Not a student" }, { status: 404 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
  }

  const scholarship = await db.scholarship.findUnique({
    where: { id: parsed.data.scholarshipId },
    select: { id: true, name: true, isActive: true },
  });

  if (!scholarship || !scholarship.isActive) {
    return NextResponse.json({ error: "Scholarship not found" }, { status: 404 });
  }

  if (parsed.data.applicationId) {
    const application = await db.application.findUnique({
      where: { id: parsed.data.applicationId },
      select: { id: true, studentId: true },
    });

    if (!application || application.studentId !== student.id) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }
  }

  const existing = await db.studentScholarshipApplication.findFirst({
    where: { studentId: student.id, scholarshipId: scholarship.id },
    select: { id: true, status: true, appliedAt: true, applicationId: true },
  });

  let application;
  if (existing) {
    application = await db.studentScholarshipApplication.update({
      where: { id: existing.id },
      data: {
        status: parsed.data.status,
        appliedAt: parsed.data.status === "APPLIED" ? (existing.appliedAt ?? new Date()) : existing.appliedAt,
        applicationId: parsed.data.applicationId ?? existing.applicationId,
      },
    });
  } else {
    application = await db.studentScholarshipApplication.create({
      data: {
        studentId: student.id,
        scholarshipId: scholarship.id,
        applicationId: parsed.data.applicationId ?? null,
        status: parsed.data.status,
        appliedAt: parsed.data.status === "APPLIED" ? new Date() : null,
      },
    });
  }

  if (student.assignedCounsellorId) {
    await db.notification.create({
      data: {
        userId: student.assignedCounsellorId,
        type: "SCHOLARSHIP_STATUS_UPDATED",
        message: `${student.firstName} ${student.lastName} marked ${scholarship.name} as ${parsed.data.status.toLowerCase()}.`,
        linkUrl: `/dashboard/students/${student.id}`,
      },
    });
  }

  await db.activityLog.create({
    data: {
      userId: session.user.id,
      entityType: "StudentScholarshipApplication",
      entityId: application.id,
      action: "student_scholarship_status_updated",
      details: `Status set to ${parsed.data.status}`,
    },
  });

  return NextResponse.json({ data: application });
}
