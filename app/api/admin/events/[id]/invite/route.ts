import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendResendEmail } from "@/lib/resend";

const inviteSchema = z.object({
  studentIds: z.array(z.string().min(1)).min(1),
});

function canInvite(roleName?: string) {
  return roleName === "ADMIN" || roleName === "MANAGER" || roleName === "COUNSELLOR";
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !canInvite(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const parsed = inviteSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }

    const event = await db.preDepartureEvent.findUnique({ where: { id: params.id } });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const studentIds = Array.from(new Set(parsed.data.studentIds));
    const existing = await db.eventInvitation.findMany({
      where: { eventId: params.id, studentId: { in: studentIds } },
      select: { studentId: true },
    });
    const existingIds = new Set(existing.map((item) => item.studentId));
    const toCreateIds = studentIds.filter((id) => !existingIds.has(id));

    if (!toCreateIds.length) {
      return NextResponse.json({ data: { created: 0, sent: 0 } });
    }

    await db.eventInvitation.createMany({
      data: toCreateIds.map((studentId) => ({ eventId: params.id, studentId })),
    });

    const invitations = await db.eventInvitation.findMany({
      where: { eventId: params.id, studentId: { in: toCreateIds } },
      select: { id: true, studentId: true },
    });

    const students = await db.student.findMany({
      where: { id: { in: toCreateIds } },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    const studentMap = new Map(students.map((student) => [student.id, student]));

    const baseUrl = process.env.NEXTAUTH_URL || process.env.APP_URL || request.nextUrl.origin;
    let sent = 0;

    for (const invitation of invitations) {
      const student = studentMap.get(invitation.studentId);
      if (!student?.email) continue;

      const studentName = `${student.firstName} ${student.lastName}`;
      const rsvpUrl = `${baseUrl}/events/rsvp/${invitation.id}`;
      const dateLabel = new Date(event.eventDate).toLocaleDateString("en-GB");
      const locationLabel = event.isOnline ? event.onlineLink || event.location : event.location;

      await sendResendEmail({
        to: student.email,
        subject: "You are invited to a Pre-Departure Event",
        html: `
          <p>Dear ${studentName},</p>
          <p>You are invited to ${event.title}.</p>
          <p><strong>Date:</strong> ${dateLabel} at ${event.eventTime}</p>
          <p><strong>Location:</strong> ${locationLabel}</p>
          <p>Please RSVP by clicking below:</p>
          <p>
            <a href="${rsvpUrl}?choice=ATTENDING" style="display:inline-block;padding:10px 16px;background:#16a34a;color:#fff;text-decoration:none;border-radius:6px;margin-right:8px;">Attending</a>
            <a href="${rsvpUrl}?choice=NOT_ATTENDING" style="display:inline-block;padding:10px 16px;background:#dc2626;color:#fff;text-decoration:none;border-radius:6px;">Not Attending</a>
          </p>
          <p>Or open this page: <a href="${rsvpUrl}">${rsvpUrl}</a></p>
        `,
      });

      await db.eventInvitation.update({
        where: { id: invitation.id },
        data: { emailSentAt: new Date() },
      });

      sent += 1;
    }

    return NextResponse.json({ data: { created: invitations.length, sent } });
  } catch (error) {
    console.error("[POST /api/admin/events/[id]/invite]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
