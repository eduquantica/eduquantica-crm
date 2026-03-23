import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { PickupStatus } from "@prisma/client";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { NotificationService } from "@/lib/notifications";
import { sendResendEmail } from "@/lib/resend";

const updateSchema = z.object({
  status: z.nativeEnum(PickupStatus),
  adminNote: z.string().trim().optional().nullable(),
  confirmedBy: z.string().trim().optional().nullable(),
});

function canRead(roleName?: string) {
  return roleName === "ADMIN" || roleName === "MANAGER" || roleName === "COUNSELLOR";
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !canRead(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }

    const existing = await db.airportPickupBooking.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const updated = await db.airportPickupBooking.update({
      where: { id: params.id },
      data: {
        status: parsed.data.status,
        adminNote: parsed.data.adminNote,
        confirmedBy: parsed.data.confirmedBy ?? session.user.name ?? session.user.email,
        confirmedAt: parsed.data.status === "CONFIRMED" ? new Date() : undefined,
      },
    });

    const student = await db.student.findUnique({
      where: { id: updated.studentId },
      select: { userId: true, firstName: true, lastName: true, email: true },
    });

    if (student?.userId) {
      const isNewlyConfirmed = existing.status !== PickupStatus.CONFIRMED && updated.status === PickupStatus.CONFIRMED;
      const arrivalDateLabel = updated.arrivalDate.toISOString().split("T")[0];

      const message = isNewlyConfirmed
        ? `Your airport pickup is confirmed. Someone will meet you at ${updated.airport} on ${arrivalDateLabel} at ${updated.arrivalTime}.`
        : `Airport pickup for ${student.firstName} ${student.lastName} updated to ${updated.status.replaceAll("_", " ")}.`;

      await NotificationService.createNotification({
        userId: student.userId,
        type: isNewlyConfirmed ? "AIRPORT_PICKUP_CONFIRMED" : "AIRPORT_PICKUP_UPDATE",
        message,
        linkUrl: "/student/services",
        actorUserId: session.user.id,
      }).catch(() => undefined);

      if (isNewlyConfirmed && student.email) {
        await sendResendEmail({
          to: student.email,
          subject: "Your airport pickup is confirmed",
          html: `<p>Hello ${student.firstName} ${student.lastName},</p><p>Your airport pickup is confirmed.</p><p>Someone will meet you at <strong>${updated.airport}</strong> on <strong>${arrivalDateLabel}</strong> at <strong>${updated.arrivalTime}</strong>.</p>`,
        }).catch(() => undefined);
      }
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("[PATCH /api/admin/airport-pickup/[id]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}