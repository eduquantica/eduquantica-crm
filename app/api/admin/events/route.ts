import { EventStatus } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { NotificationService } from "@/lib/notifications";

const eventSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().optional().nullable(),
  eventDate: z.string().min(1),
  eventTime: z.string().trim().min(1),
  isOnline: z.boolean().default(false),
  location: z.string().trim().min(1),
  city: z.string().trim().min(1),
  country: z.string().trim().min(1),
  venueAddress: z.string().trim().optional().nullable(),
  onlineLink: z.string().trim().optional().nullable(),
  targetCountry: z.string().trim().min(1),
  maxAttendees: z.number().int().positive().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  status: z.nativeEnum(EventStatus).default(EventStatus.DRAFT),
});

function canManageEvents(roleName?: string) {
  return roleName === "ADMIN" || roleName === "MANAGER" || roleName === "COUNSELLOR" || roleName === "BRANCH_MANAGER" || roleName === "SUB_AGENT_COUNSELLOR";
}

function asDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !canManageEvents(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const status = request.nextUrl.searchParams.get("status") || "";
    const targetCountry = request.nextUrl.searchParams.get("targetCountry")?.trim() || "";

    const events = await db.preDepartureEvent.findMany({
      where: {
        ...(status && Object.values(EventStatus).includes(status as EventStatus) ? { status: status as EventStatus } : {}),
        ...(targetCountry ? { targetCountry: { contains: targetCountry, mode: "insensitive" } } : {}),
      },
      include: {
        _count: { select: { invitations: true, attendees: true } },
      },
      orderBy: [{ eventDate: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ data: events });
  } catch (error) {
    console.error("[GET /api/admin/events]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !canManageEvents(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const parsed = eventSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }

    const eventDate = asDate(parsed.data.eventDate);
    if (!eventDate) {
      return NextResponse.json({ error: "Invalid event date" }, { status: 400 });
    }

    const event = await db.preDepartureEvent.create({
      data: {
        ...parsed.data,
        eventDate,
        organiserUserId: session.user.id,
      },
    });

    if (event.status === EventStatus.PUBLISHED) {
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

    return NextResponse.json({ data: event }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/admin/events]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
