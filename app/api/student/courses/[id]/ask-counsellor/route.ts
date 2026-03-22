import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { TaskPriority, TaskStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
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

  if (!student.assignedCounsellorId) {
    return NextResponse.json({ error: "No counsellor assigned yet" }, { status: 400 });
  }

  const course = await db.course.findUnique({
    where: { id: params.id },
    select: { id: true, name: true },
  });

  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  const title = `Eligibility help requested: ${course.name}`;
  const existing = await db.task.findFirst({
    where: {
      userId: student.assignedCounsellorId,
      studentId: student.id,
      title,
      status: {
        in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS],
      },
    },
    select: { id: true },
  });

  if (!existing) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 2);

    await db.task.create({
      data: {
        userId: student.assignedCounsellorId,
        studentId: student.id,
        title,
        description: `Student ${`${student.firstName || ""} ${student.lastName || ""}`.trim() || student.id} requested guidance on partial eligibility for ${course.name}.`,
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.PENDING,
        dueDate,
      },
    });
  }

  return NextResponse.json({ data: { ok: true } });
}
