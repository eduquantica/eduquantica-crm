import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { sendResendEmail } from "@/lib/resend";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = req.url.split("/").pop();
    if (!id) {
      return NextResponse.json({ error: "Missing task id" }, { status: 400 });
    }

    const task = await db.task.findUnique({
      where: { id },
      include: { student: true, lead: true, user: true },
    });
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // permissions
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      include: { role: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const isCounsellor = user.role.name === "COUNSELLOR";
    if (isCounsellor && task.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ data: task });
  } catch (error) {
    console.error("Error fetching task:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
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

    const id = req.url.split("/").pop();
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const existing = await db.task.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // counsellor permission
    const isCounsellor = user.role.name === "COUNSELLOR";
    if (isCounsellor && existing.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
      status,
    } = body;

    const updated = await db.task.update({
      where: { id },
      data: {
        title: title ?? existing.title,
        description: description !== undefined ? description : existing.description,
        studentId: studentId || null,
        leadId: leadId || null,
        userId: assignedTo || existing.userId,
        priority: priority || existing.priority,
        dueDate: dueDate ? new Date(dueDate) : existing.dueDate,
        status: status || existing.status,
        completedAt: status === "COMPLETED" ? new Date() : existing.completedAt,
      },
    });

    await db.activityLog.create({
      data: {
        userId: user.id,
        entityType: "task",
        entityId: id,
        action: "updated_task",
        details: JSON.stringify({ before: existing, after: updated }),
      },
    });

    if (assignedTo && assignedTo !== existing.userId && assignedTo !== user.id) {
      const counsellor = await db.user.findUnique({ where: { id: assignedTo } });
      if (counsellor?.email) {
        await sendResendEmail({
          to: counsellor.email,
          subject: "Task assigned to you",
          html: `You have been assigned the task "${updated.title}".`,
        });
        await db.activityLog.create({
          data: {
            userId: user.id,
            entityType: "task",
            entityId: id,
            action: "email_sent",
            details: `Email sent to ${counsellor.email}`,
          },
        });
      }
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("Error updating task:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
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

    if (user.role.name !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const id = req.url.split("/").pop();
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    await db.task.delete({ where: { id } });
    await db.activityLog.create({
      data: {
        userId: user.id,
        entityType: "task",
        entityId: id,
        action: "deleted_task",
        details: "",
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting task:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}