import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const paramsSchema = z.object({
  id: z.string().min(1),
});

const updateSchema = z.object({
  employerName: z.string().trim().min(1, "Employer name is required").optional(),
  jobTitle: z.string().trim().min(1, "Job title is required").optional(),
  location: z.string().trim().optional().nullable(),
  startDate: z.string().trim().optional().nullable(),
  endDate: z.string().trim().optional().nullable(),
  isCurrentlyWorking: z.boolean().optional(),
  responsibilities: z.string().trim().optional().nullable(),
  orderIndex: z.number().int().min(0).optional(),
});

async function getStudentId() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.roleName !== "STUDENT") {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!student) {
    return { error: NextResponse.json({ error: "Student profile not found" }, { status: 404 }) } as const;
  }

  return { studentId: student.id } as const;
}

function toDateOrNull(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getStudentId();
  if ("error" in ctx) return ctx.error;

  try {
    const { id } = paramsSchema.parse(params);
    const payload = updateSchema.parse(await req.json());

    const existing = await db.workExperience.findFirst({
      where: {
        id,
        studentId: ctx.studentId,
      },
      select: {
        id: true,
        isCurrentlyWorking: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Work experience not found" }, { status: 404 });
    }

    const isCurrentlyWorking = payload.isCurrentlyWorking ?? existing.isCurrentlyWorking;

    const updated = await db.workExperience.update({
      where: { id: existing.id },
      data: {
        employerName: payload.employerName,
        jobTitle: payload.jobTitle,
        location: payload.location === undefined ? undefined : payload.location || null,
        startDate: payload.startDate === undefined ? undefined : toDateOrNull(payload.startDate),
        endDate: isCurrentlyWorking
          ? null
          : payload.endDate === undefined
            ? undefined
            : toDateOrNull(payload.endDate),
        isCurrentlyWorking,
        responsibilities: payload.responsibilities === undefined ? undefined : payload.responsibilities || null,
        orderIndex: payload.orderIndex,
      },
    });

    return NextResponse.json({
      data: {
        id: updated.id,
        employerName: updated.employerName,
        jobTitle: updated.jobTitle,
        location: updated.location || "",
        startDate: updated.startDate ? updated.startDate.toISOString().slice(0, 10) : "",
        endDate: updated.endDate ? updated.endDate.toISOString().slice(0, 10) : "",
        isCurrentlyWorking: updated.isCurrentlyWorking,
        responsibilities: updated.responsibilities || "",
        orderIndex: updated.orderIndex,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }
    console.error("[/api/student/work-experience/[id] PATCH]", error);
    return NextResponse.json({ error: "Failed to update work experience" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getStudentId();
  if ("error" in ctx) return ctx.error;

  try {
    const { id } = paramsSchema.parse(params);

    const existing = await db.workExperience.findFirst({
      where: {
        id,
        studentId: ctx.studentId,
      },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Work experience not found" }, { status: 404 });
    }

    await db.workExperience.delete({ where: { id: existing.id } });

    const remainingCount = await db.workExperience.count({ where: { studentId: ctx.studentId } });
    if (remainingCount === 0) {
      await db.student.update({
        where: { id: ctx.studentId },
        data: { hasWorkExperience: false },
      });
    }

    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid request" }, { status: 400 });
    }
    console.error("[/api/student/work-experience/[id] DELETE]", error);
    return NextResponse.json({ error: "Failed to delete work experience" }, { status: 500 });
  }
}
