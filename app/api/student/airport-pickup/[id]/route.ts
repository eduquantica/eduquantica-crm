import { ServicePaymentType, ServicePayStatus } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { NotificationService } from "@/lib/notifications";
import { sendResendEmail } from "@/lib/resend";

// SERVICE PAYMENTS - NO COMMISSION
// These payments go directly to
// EduQuantica only.
// Do NOT link to Commission model.
// Do NOT calculate sub-agent commission.

const resubmitSchema = z.object({
  paymentProofUrl: z.string().trim().min(1),
  paymentProofName: z.string().trim().min(1),
});

function canAccess(roleName?: string) {
  return Boolean(roleName);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !canAccess(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const parsed = resubmitSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }

    const booking = await db.airportPickupBooking.findUnique({ where: { id: params.id } });
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (session.user.roleName === "STUDENT") {
      const student = await db.student.findUnique({ where: { userId: session.user.id }, select: { id: true } });
      if (!student || student.id !== booking.studentId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const payment = await db.servicePayment.findFirst({
      where: {
        referenceId: booking.id,
        serviceType: ServicePaymentType.AIRPORT_PICKUP,
      },
    });

    if (!payment) {
      return NextResponse.json({ error: "Payment record not found" }, { status: 404 });
    }

    const updated = await db.servicePayment.update({
      where: { id: payment.id },
      data: {
        paymentProofUrl: parsed.data.paymentProofUrl,
        paymentProofName: parsed.data.paymentProofName,
        status: ServicePayStatus.PROOF_UPLOADED,
        rejectionReason: null,
      },
    });

    const [student, adminUsers] = await Promise.all([
      db.student.findUnique({
        where: { id: booking.studentId },
        select: { firstName: true, lastName: true, assignedCounsellorId: true },
      }),
      db.user.findMany({ where: { role: { name: "ADMIN" } }, select: { id: true } }),
    ]);

    const studentName = student
      ? `${student.firstName} ${student.lastName}`.trim()
      : "Student";

    const notifyUserIds = Array.from(new Set([
      ...adminUsers.map((user) => user.id),
      student?.assignedCounsellorId || "",
    ].filter(Boolean)));

    await Promise.all(
      notifyUserIds.map((userId) =>
        NotificationService.createNotification({
          userId,
          type: "SERVICE_PAYMENT_RESUBMITTED",
          message: `${studentName} resubmitted payment proof for airport pickup booking ${booking.id.slice(-8).toUpperCase()}.`,
          linkUrl: "/dashboard/student-services",
          actorUserId: session.user.id,
        }).catch(() => undefined),
      ),
    );

    await sendResendEmail({
      to: process.env.ADMIN_INBOX_EMAIL || "admin@eduquantica.com",
      subject: "Payment Proof Resubmitted - Airport Pickup",
      html: `<p>${studentName} resubmitted airport pickup payment proof.</p><p>Booking reference: ${booking.id.slice(-8).toUpperCase()}</p><p>Please review in dashboard.</p>`,
    }).catch(() => undefined);

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("[PATCH /api/student/airport-pickup/[id]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}