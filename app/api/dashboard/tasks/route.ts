import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { sendResendEmail } from "@/lib/resend";
import { Prisma, type TaskPriority, type TaskStatus } from "@prisma/client";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
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

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const assignedTo = searchParams.get("assignedTo");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const hideCompleted = searchParams.get("hideCompleted");
    const search = searchParams.get("search");

    const where: Prisma.TaskWhereInput = {};

    if (status) where.status = status as TaskStatus;
    if (priority) where.priority = priority as TaskPriority;
    if (assignedTo) where.userId = assignedTo;
    if (hideCompleted === "1" || hideCompleted === "true") {
      where.status = { not: "COMPLETED" };
    }
    if (from || to) {
      where.dueDate = {};
      if (from) where.dueDate!.gte = new Date(from);
      if (to) where.dueDate!.lte = new Date(to);
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const isCounsellor = user.role.name === "COUNSELLOR";
    if (isCounsellor) {
      where.userId = user.id; // only show tasks assigned to them
    }

    const tasks = await db.task.findMany({
      where,
      include: {
        student: true,
        lead: true,
        user: true,
      },
      orderBy: { dueDate: "asc" },
    });

    return NextResponse.json({ data: tasks });
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
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

    const body = await req.json();
    const {
      title,
      description,
      studentId,
      leadId,
      assignedTo,
      priority,
      dueDate,
    } = body;

    if (!title) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    // determine who the task is assigned to (default to creator)
    const assignedUserId = assignedTo || user.id;

    const created = await db.task.create({
      data: {
        userId: assignedUserId,
        title,
        description: description || null,
        studentId: studentId || null,
        leadId: leadId || null,
        priority: priority || "MEDIUM",
        dueDate: dueDate ? new Date(dueDate) : null,
      },
    });

    await db.activityLog.create({
      data: {
        userId: user.id,
        entityType: "task",
        entityId: created.id,
        action: "created_task",
        details: `Task '${title}' created`,
      },
    });

    // email notification
    if (assignedTo && assignedTo !== user.id) {
      const counsellor = await db.user.findUnique({ where: { id: assignedTo } });
      if (counsellor?.email) {
        await sendResendEmail({
          to: counsellor.email,
          subject: "New task assigned to you",
          html: `A new task "${title}" has been assigned to you.`,
        });
        await db.activityLog.create({
          data: {
            userId: user.id,
            entityType: "task",
            entityId: created.id,
            action: "email_sent",
            details: `Email sent to ${counsellor.email}`,
          },
        });
      }
    }

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    console.error("Error creating task:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}