import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendResendEmail } from "@/lib/resend";
import { NotificationService } from "@/lib/notifications";



export async function GET(
  req: NextRequest,
  { params }: { params: { studentId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionUser = session.user as {
    id: string;
    email: string;
    name: string;
    roleName: string;
  };

  const studentId = params.studentId;

  try {
    // Get student to check permissions
    const student = await db.student.findUnique({
      where: { id: studentId },
      select: { 
        id: true, 
        assignedCounsellorId: true, 
        subAgentId: true,
        userId: true
      },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    // Permission check
    let hasAccess = false;
    
    // Admin and Manager can see all
    if (sessionUser.roleName === "ADMIN" || sessionUser.roleName === "MANAGER") {
      hasAccess = true;
    }
    // Counsellor can see assigned students
    else if (sessionUser.roleName === "COUNSELLOR") {
      hasAccess = student.assignedCounsellorId === sessionUser.id;
    }
    // Student can see their own messages
    else if (sessionUser.roleName === "STUDENT") {
      hasAccess = student.userId === sessionUser.id;
    }
    // Sub-agents can see their assigned students
    else if (sessionUser.roleName === "SUB_AGENT") {
      // Check if this sub-agent is linked to this student
      if (student.subAgentId) {
        const subAgent = await db.subAgent.findUnique({
          where: { id: student.subAgentId },
          select: { userId: true },
        });
        hasAccess = subAgent?.userId === sessionUser.id;
      }
    }

    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (sessionUser.roleName === "SUB_AGENT") {
      await db.communication.updateMany({
        where: {
          studentId,
          isRead: false,
          NOT: { userId: sessionUser.id },
        },
        data: { isRead: true },
      });
    }

    // Fetch all messages for this student, ordered by created date
    const messages = await db.communication.findMany({
      where: { studentId },
      select: {
        id: true,
        message: true,
        subject: true,
        user: {
          select: { id: true, name: true, role: { select: { name: true } } },
        },
        createdAt: true,
        attachmentUrl: true,
        type: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const formattedMessages = messages.map((m) => ({
      id: m.id,
      content: m.message,
      senderName: m.user.name || "Unknown",
      senderRole: m.user.role?.name || "Unknown",
      sentAt: m.createdAt.toISOString(),
      attachmentUrl: m.attachmentUrl || null,
      type: m.type,
      subject: m.subject,
    }));

    return NextResponse.json({ messages: formattedMessages });
  } catch (err) {
    const error = err as Error;
    console.error("[GET /api/messages/[studentId]]", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { studentId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionUser = session.user as {
    id: string;
    email: string;
    name: string;
    roleName: string;
  };

  const studentId = params.studentId;
  const body = await req.json() as { content?: string; attachmentUrl?: string };
  const { content, attachmentUrl } = body;

  if (!content && !attachmentUrl) {
    return NextResponse.json({ error: "Content required" }, { status: 400 });
  }

  try {
    // Get student with full details
    const student = await db.student.findUnique({
      where: { id: studentId },
      include: {
        assignedCounsellor: true,
        subAgent: { include: { user: true } },
        user: true,
      },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    // Permission check - can the current user write a message for this student?
    let hasAccess = false;
    
    // Admin and Manager can message all students
    if (sessionUser.roleName === "ADMIN" || sessionUser.roleName === "MANAGER") {
      hasAccess = true;
    }
    // Counsellor can message only their assigned students
    else if (sessionUser.roleName === "COUNSELLOR") {
      hasAccess = student.assignedCounsellorId === sessionUser.id;
    }
    // Student can only message themselves
    else if (sessionUser.roleName === "STUDENT") {
      hasAccess = student.userId === sessionUser.id;
    }
    // Sub-agents can message their assigned students
    else if (sessionUser.roleName === "SUB_AGENT") {
      if (student.subAgentId) {
        const subAgent = await db.subAgent.findUnique({
          where: { id: student.subAgentId },
          select: { userId: true },
        });
        hasAccess = subAgent?.userId === sessionUser.id;
      }
    }

    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Create the message in Communication table
    const message = await db.communication.create({
      data: {
        studentId,
        userId: sessionUser.id,
        type: "EMAIL",
        message: content || "Attachment",
        attachmentUrl: attachmentUrl || null,
        direction: "OUTBOUND", // Assume outbound for now
        subject: `Message from ${sessionUser.name}`,
      },
      include: {
        user: { select: { id: true, name: true, role: { select: { name: true } } } },
      },
    });

    const recipientIds = new Set<string>();
    if (student.userId) recipientIds.add(student.userId);
    if (student.assignedCounsellorId) recipientIds.add(student.assignedCounsellorId);
    if (student.subAgent?.userId) recipientIds.add(student.subAgent.userId);
    recipientIds.delete(sessionUser.id);

    const actorName = sessionUser.name || "A user";
    const linkByRole: Record<string, string> = {
      STUDENT: `/student/applications`,
      SUB_AGENT: `/agent/students/${student.id}`,
      COUNSELLOR: `/dashboard/students/${student.id}`,
      ADMIN: `/dashboard/students/${student.id}`,
      MANAGER: `/dashboard/students/${student.id}`,
    };

    await Promise.all(
      Array.from(recipientIds).map((userId) =>
        NotificationService.createNotification({
          userId,
          type: "SYSTEM_NEW_MESSAGE",
          message: `New message from ${actorName} for ${student.firstName} ${student.lastName}.`,
          linkUrl: linkByRole[sessionUser.roleName] || `/notifications`,
          actorUserId: sessionUser.id,
        }).catch(() => undefined),
      ),
    );

    // Send email notifications based on who posted
    try {
      if (sessionUser.roleName === "COUNSELLOR" || sessionUser.roleName === "ADMIN" || sessionUser.roleName === "MANAGER") {
        // Notify student
        if (student.email) {
          await sendResendEmail({
            to: student.email,
            subject: `New message from ${sessionUser.name} - EduQuantica`,
            html: `<p>You have received a new message from ${sessionUser.name}:</p><p>${content}</p><p>Log in to your portal to reply.</p>`,
          });
        }
        // Notify sub-agent if linked
        if (student.subAgent && student.subAgent.user?.email) {
          await sendResendEmail({
            to: student.subAgent.user.email,
            subject: `New message from ${sessionUser.name} for ${student.firstName} ${student.lastName} - EduQuantica`,
            html: `<p>A message has been posted for ${student.firstName} ${student.lastName} by ${sessionUser.name}:</p><p>${content}</p>`,
          });
        }
      } else if (sessionUser.roleName === "STUDENT") {
        // Notify assigned counsellor
        if (student.assignedCounsellor?.email) {
          await sendResendEmail({
            to: student.assignedCounsellor.email,
            subject: `New message from student ${student.firstName} ${student.lastName} - EduQuantica`,
            html: `<p>${student.firstName} ${student.lastName} has sent you a message:</p><p>${content}</p>`,
          });
        }
      } else if (sessionUser.roleName === "SUB_AGENT") {
        // Notify assigned counsellor
        if (student.assignedCounsellor?.email) {
          await sendResendEmail({
            to: student.assignedCounsellor.email,
            subject: `New message from sub-agent for ${student.firstName} ${student.lastName} - EduQuantica`,
            html: `<p>A message has been posted for ${student.firstName} ${student.lastName} by a sub-agent:</p><p>${content}</p>`,
          });
        }
      }
    } catch (emailErr) {
      console.error("Error sending notification email:", emailErr);
      // Don't fail the request if email fails
    }

    // Log activity
    await db.activityLog.create({
      data: {
        userId: sessionUser.id,
        entityType: "message",
        entityId: message.id,
        action: "created",
        details: `Sent message to student ${studentId}`,
      },
    });

    return NextResponse.json({
      id: message.id,
      content: message.message,
      senderName: message.user.name || "Unknown",
      senderRole: message.user.role?.name || "Unknown",
      sentAt: message.createdAt.toISOString(),
      attachmentUrl: message.attachmentUrl,
    });
  } catch (err) {
    const error = err as Error;
    console.error("[POST /api/messages/[studentId]]", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
