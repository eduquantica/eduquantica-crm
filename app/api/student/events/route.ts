import { EventStatus } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.roleName !== "STUDENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const student = await db.student.findUnique({ where: { userId: session.user.id }, select: { id: true } });
    if (!student) {
      return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
    }

    const invitations = await db.eventInvitation.findMany({
      where: {
        studentId: student.id,
        event: {
          status: { in: [EventStatus.PUBLISHED, EventStatus.COMPLETED, EventStatus.CANCELLED] },
        },
      },
      include: { event: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      data: invitations.map((invitation) => ({
        invitationId: invitation.id,
        rsvpStatus: invitation.rsvpStatus,
        rsvpAt: invitation.rsvpAt,
        event: invitation.event,
      })),
    });
  } catch (error) {
    console.error("[GET /api/student/events]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}