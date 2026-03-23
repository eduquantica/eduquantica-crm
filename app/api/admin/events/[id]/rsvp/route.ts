import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const attendeeSchema = z.object({
  studentId: z.string().min(1),
});

function canViewRsvp(roleName?: string) {
  return roleName === "ADMIN" || roleName === "MANAGER" || roleName === "COUNSELLOR";
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !canViewRsvp(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const event = await db.preDepartureEvent.findUnique({
      where: { id: params.id },
      include: { attendees: true },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const invitations = await db.eventInvitation.findMany({
      where: { eventId: params.id },
      orderBy: { createdAt: "desc" },
    });

    const studentIds = Array.from(new Set(invitations.map((item) => item.studentId)));
    const students = studentIds.length
      ? await db.student.findMany({
          where: { id: { in: studentIds } },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      : [];
    const studentMap = new Map(students.map((student) => [student.id, student]));

    const data = invitations.map((invitation) => {
      const student = studentMap.get(invitation.studentId);
      return {
        id: invitation.id,
        studentId: invitation.studentId,
        studentName: student ? `${student.firstName} ${student.lastName}` : invitation.studentId,
        studentEmail: student?.email || null,
        invitationSent: invitation.emailSentAt,
        rsvpStatus: invitation.rsvpStatus,
        rsvpDate: invitation.rsvpAt,
        attended: event.attendees.some((item) => item.studentId === invitation.studentId),
      };
    });

    return NextResponse.json({ data });
  } catch (error) {
    console.error("[GET /api/admin/events/[id]/rsvp]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !canViewRsvp(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const parsed = attendeeSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }

    const event = await db.preDepartureEvent.findUnique({ where: { id: params.id } });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (new Date(event.eventDate) > new Date()) {
      return NextResponse.json({ error: "Attendance can only be marked after event date" }, { status: 400 });
    }

    const existing = await db.eventAttendee.findFirst({
      where: { eventId: params.id, studentId: parsed.data.studentId },
    });

    if (!existing) {
      await db.eventAttendee.create({
        data: {
          eventId: params.id,
          studentId: parsed.data.studentId,
          checkedInAt: new Date(),
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[POST /api/admin/events/[id]/rsvp]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
