import { RsvpStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { NotificationService } from "@/lib/notifications";

const updateSchema = z.object({
  status: z.enum(["ATTENDING", "NOT_ATTENDING"]),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: { invitationId: string } },
) {
  try {
    const invitation = await db.eventInvitation.findUnique({
      where: { id: params.invitationId },
      include: { event: true },
    });

    if (!invitation) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    const student = await db.student.findUnique({
      where: { id: invitation.studentId },
      select: { firstName: true, lastName: true, email: true },
    });

    return NextResponse.json({
      data: {
        id: invitation.id,
        rsvpStatus: invitation.rsvpStatus,
        event: invitation.event,
        studentName: student ? `${student.firstName} ${student.lastName}` : "Student",
        studentEmail: student?.email || null,
      },
    });
  } catch (error) {
    console.error("[GET /api/events/rsvp/[invitationId]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { invitationId: string } },
) {
  try {
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }

    const status = parsed.data.status === "ATTENDING" ? RsvpStatus.ATTENDING : RsvpStatus.NOT_ATTENDING;

    const invitation = await db.eventInvitation.findUnique({
      where: { id: params.invitationId },
      include: { event: true },
    });

    if (!invitation) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    const student = await db.student.findUnique({
      where: { id: invitation.studentId },
      select: { firstName: true, lastName: true, userId: true },
    });

    const updated = await db.eventInvitation.update({
      where: { id: params.invitationId },
      data: {
        rsvpStatus: status,
        rsvpAt: new Date(),
      },
    });

    const studentName = student
      ? `${student.firstName} ${student.lastName}`.trim()
      : "Student";
    const responseLabel = status === RsvpStatus.ATTENDING ? "ATTENDING" : "NOT_ATTENDING";

    await NotificationService.createNotification({
      userId: invitation.event.organiserUserId,
      type: "EVENT_RSVP_RESPONSE",
      message: `${studentName} has responded ${responseLabel} to ${invitation.event.title}.`,
      linkUrl: `/dashboard/student-services/events`,
      actorUserId: student?.userId,
    }).catch(() => undefined);

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("[POST /api/events/rsvp/[invitationId]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
