import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { ApplicationStatus } from "@prisma/client";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureFeePaymentForApplication, getApplicationFeeSummary } from "@/lib/application-fees";

const payloadSchema = z.object({
  courseId: z.string().min(1),
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

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.roleName !== "STUDENT" && session.user.roleName !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = payloadSchema.parse(await req.json());

    const student = await db.student.findUnique({
      where: { userId: session.user.id },
      select: {
        id: true,
        assignedCounsellorId: true,
      },
    });

    if (!student) {
      return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
    }

    const course = await db.course.findUnique({
      where: { id: payload.courseId },
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

    const existing = await db.application.findFirst({
      where: {
        studentId: student.id,
        courseId: course.id,
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
          error: "You already have an active application for this course. View it instead.",
          existingApplicationId: existing.id,
          data: {
            application: {
              id: existing.id,
              status: existing.status,
            },
            applicationId: existing.id,
          },
        },
        { status: 409 },
      );
    }

    const requestedUcas = Boolean(payload.isUcas);
    const isUndergraduate = (course.level || "").toLowerCase().includes("undergraduate")
      || (course.level || "").toUpperCase().startsWith("UG");
    const applyUcas = requestedUcas && isUndergraduate;

    const created = await db.application.create({
      data: {
        studentId: student.id,
        courseId: course.id,
        universityId: course.universityId,
        counsellorId: student.assignedCounsellorId || null,
        status: ApplicationStatus.APPLIED,
        isUcas: applyUcas,
      },
      select: {
        id: true,
      },
    });

    await ensureFeePaymentForApplication(created.id);
    const feeSummary = await getApplicationFeeSummary(created.id);

    await db.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: "application",
        entityId: created.id,
        action: "student_application_created",
        details: `courseId:${course.id}`,
      },
    });

    return NextResponse.json(
      {
        data: {
          application: { id: created.id },
          applicationId: created.id,
          fee: feeSummary,
          ucasWarning: requestedUcas && !isUndergraduate
            ? "UCAS fee applies to undergraduate applications only"
            : null,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }

    console.error("[/api/student/applications/create POST]", error);
    return NextResponse.json({ error: "Failed to create application" }, { status: 500 });
  }
}
