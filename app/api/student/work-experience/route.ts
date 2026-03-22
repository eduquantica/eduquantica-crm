import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const createSchema = z.object({
  employerName: z.string().trim().min(1, "Employer name is required"),
  jobTitle: z.string().trim().min(1, "Job title is required"),
  location: z.string().trim().optional().nullable(),
  startDate: z.string().trim().optional().nullable(),
  endDate: z.string().trim().optional().nullable(),
  isCurrentlyWorking: z.boolean().default(false),
  responsibilities: z.string().trim().optional().nullable(),
  orderIndex: z.number().int().min(0).optional(),
});

async function getStudentContext() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.roleName !== "STUDENT") {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    select: { id: true, hasWorkExperience: true },
  });

  if (!student) {
    return { error: NextResponse.json({ error: "Student profile not found" }, { status: 404 }) } as const;
  }

  return { student } as const;
}

function toDateOrNull(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET() {
  const ctx = await getStudentContext();
  if ("error" in ctx) return ctx.error;

  const entries = await db.workExperience.findMany({
    where: { studentId: ctx.student.id },
    orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({
    data: {
      hasWorkExperience: ctx.student.hasWorkExperience,
      entries: entries.map((row) => ({
        id: row.id,
        employerName: row.employerName,
        jobTitle: row.jobTitle,
        location: row.location || "",
        startDate: row.startDate ? row.startDate.toISOString().slice(0, 10) : "",
        endDate: row.endDate ? row.endDate.toISOString().slice(0, 10) : "",
        isCurrentlyWorking: row.isCurrentlyWorking,
        responsibilities: row.responsibilities || "",
        orderIndex: row.orderIndex,
      })),
    },
  });
}

export async function POST(req: Request) {
  const ctx = await getStudentContext();
  if ("error" in ctx) return ctx.error;

  try {
    const payload = createSchema.parse(await req.json());
    const startDate = toDateOrNull(payload.startDate);
    const endDate = payload.isCurrentlyWorking ? null : toDateOrNull(payload.endDate);

    const maxRow = await db.workExperience.findFirst({
      where: { studentId: ctx.student.id },
      orderBy: { orderIndex: "desc" },
      select: { orderIndex: true },
    });

    const created = await db.workExperience.create({
      data: {
        studentId: ctx.student.id,
        employerName: payload.employerName,
        jobTitle: payload.jobTitle,
        location: payload.location || null,
        startDate,
        endDate,
        isCurrentlyWorking: payload.isCurrentlyWorking,
        responsibilities: payload.responsibilities || null,
        orderIndex: payload.orderIndex ?? (maxRow?.orderIndex ?? -1) + 1,
      },
    });

    if (ctx.student.hasWorkExperience !== true) {
      await db.student.update({
        where: { id: ctx.student.id },
        data: { hasWorkExperience: true },
      });
    }

    return NextResponse.json({
      data: {
        id: created.id,
        employerName: created.employerName,
        jobTitle: created.jobTitle,
        location: created.location || "",
        startDate: created.startDate ? created.startDate.toISOString().slice(0, 10) : "",
        endDate: created.endDate ? created.endDate.toISOString().slice(0, 10) : "",
        isCurrentlyWorking: created.isCurrentlyWorking,
        responsibilities: created.responsibilities || "",
        orderIndex: created.orderIndex,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }
    console.error("[/api/student/work-experience POST]", error);
    return NextResponse.json({ error: "Failed to create work experience" }, { status: 500 });
  }
}
