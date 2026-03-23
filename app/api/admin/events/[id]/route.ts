import { EventStatus } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { NotificationService } from "@/lib/notifications";

const updateSchema = z.object({
  title: z.string().trim().min(1).optional(),
  description: z.string().trim().optional().nullable(),
  eventDate: z.string().optional(),
  eventTime: z.string().trim().min(1).optional(),
  isOnline: z.boolean().optional(),
  location: z.string().trim().min(1).optional(),
  city: z.string().trim().min(1).optional(),
  country: z.string().trim().min(1).optional(),
  venueAddress: z.string().trim().optional().nullable(),
  onlineLink: z.string().trim().optional().nullable(),
  targetCountry: z.string().trim().min(1).optional(),
  maxAttendees: z.number().int().positive().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  status: z.nativeEnum(EventStatus).optional(),
});

function canReadWrite(roleName?: string) {
  return roleName === "ADMIN" || roleName === "MANAGER" || roleName === "COUNSELLOR";
}

function asDate(value?: string) {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !canReadWrite(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const event = await db.preDepartureEvent.findUnique({
      where: { id: params.id },
      include: {
        invitations: { orderBy: { createdAt: "desc" } },
        attendees: true,
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const invitedStudentIds = Array.from(new Set(event.invitations.map((item) => item.studentId)));
    const invitationStudents = invitedStudentIds.length
      ? await db.student.findMany({
          where: { id: { in: invitedStudentIds } },
          select: { id: true, firstName: true, lastName: true, email: true, country: true },
        })
      : [];
    const studentMap = new Map(invitationStudents.map((student) => [student.id, student]));

    const eligibleVisaApps = await db.visaApplication.findMany({
      where: {
        status: "APPROVED",
        country: { equals: event.targetCountry, mode: "insensitive" },
      },
      select: {
        studentId: true,
        status: true,
        country: true,
        student: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    const eligibleStudents = eligibleVisaApps
      .filter((item) => !invitedStudentIds.includes(item.studentId))
      .map((item) => ({
        id: item.student.id,
        name: `${item.student.firstName} ${item.student.lastName}`,
        email: item.student.email,
        destination: item.country,
        visaStatus: "VISA_APPROVED",
      }));

    const invitations = event.invitations.map((invitation) => {
      const student = studentMap.get(invitation.studentId);
      return {
        ...invitation,
        studentName: student ? `${student.firstName} ${student.lastName}` : invitation.studentId,
        studentEmail: student?.email || null,
        destination: student?.country || null,
        attended: event.attendees.some((attendee) => attendee.studentId === invitation.studentId),
      };
    });

    return NextResponse.json({
      data: {
        event,
        invitations,
        eligibleStudents,
      },
    });
  } catch (error) {
    console.error("[GET /api/admin/events/[id]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !canReadWrite(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }

    const eventDate = asDate(parsed.data.eventDate);
    if (eventDate === null) {
      return NextResponse.json({ error: "Invalid event date" }, { status: 400 });
    }

    const existingEvent = await db.preDepartureEvent.findUnique({
      where: { id: params.id },
      select: { id: true, status: true },
    });

    if (!existingEvent) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const event = await db.preDepartureEvent.update({
      where: { id: params.id },
      data: {
        ...parsed.data,
        ...(eventDate ? { eventDate } : {}),
      },
    });

    const becamePublished = existingEvent.status !== EventStatus.PUBLISHED && event.status === EventStatus.PUBLISHED;
    if (becamePublished) {
      const invitations = await db.eventInvitation.findMany({
        where: { eventId: event.id },
        select: { studentId: true },
      });

      const studentIds = Array.from(new Set(invitations.map((invitation) => invitation.studentId)));
      if (studentIds.length) {
        const students = await db.student.findMany({
          where: { id: { in: studentIds } },
          select: { userId: true },
        });

        const eventDateLabel = event.eventDate.toISOString().split("T")[0];
        await Promise.all(
          students
            .map((student) => student.userId)
            .filter(Boolean)
            .map((userId) =>
              NotificationService.createNotification({
                userId,
                type: "EVENT_PUBLISHED",
                message: `You have been invited to ${event.title} on ${eventDateLabel}. Please RSVP.`,
                linkUrl: "/student/services",
                actorUserId: session.user.id,
              }).catch(() => undefined),
            ),
        );
      }
    }

    return NextResponse.json({ data: event });
  } catch (error) {
    console.error("[PATCH /api/admin/events/[id]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !canReadWrite(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await db.$transaction([
      db.eventAttendee.deleteMany({ where: { eventId: params.id } }),
      db.eventInvitation.deleteMany({ where: { eventId: params.id } }),
      db.preDepartureEvent.delete({ where: { id: params.id } }),
    ]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/admin/events/[id]]", error);
    return NextResponse.json({ error: "Unable to delete event" }, { status: 400 });
  }
}
