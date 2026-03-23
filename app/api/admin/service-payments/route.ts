import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { ServicePayStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// SERVICE PAYMENTS - NO COMMISSION
// These payments go directly to
// EduQuantica only.
// Do NOT link to Commission model.
// Do NOT calculate sub-agent commission.

function canManage(roleName?: string) {
  return roleName === "ADMIN" || roleName === "MANAGER";
}

function monthStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !canManage(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payments = await db.servicePayment.findMany({ orderBy: { createdAt: "desc" } });

    const studentIds = Array.from(new Set(payments.map((payment) => payment.studentId)));
    const referenceIds = Array.from(new Set(payments.map((payment) => payment.referenceId)));

    const [students, bookings] = await Promise.all([
      studentIds.length
        ? db.student.findMany({
            where: { id: { in: studentIds } },
            select: { id: true, firstName: true, lastName: true, email: true },
          })
        : Promise.resolve([]),
      referenceIds.length
        ? db.airportPickupBooking.findMany({
            where: { id: { in: referenceIds } },
            select: { id: true, airport: true, arrivalDate: true, arrivalTime: true },
          })
        : Promise.resolve([]),
    ]);

    const studentMap = new Map(students.map((student) => [student.id, student]));
    const bookingMap = new Map(bookings.map((booking) => [booking.id, booking]));

    const data = payments.map((payment) => {
      const student = studentMap.get(payment.studentId);
      const booking = bookingMap.get(payment.referenceId);
      return {
        id: payment.id,
        studentId: payment.studentId,
        studentName: student ? `${student.firstName} ${student.lastName}`.trim() : payment.studentId,
        studentEmail: student?.email || null,
        serviceType: payment.serviceType,
        description: payment.description,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        paymentMethod: payment.paymentMethod,
        paymentProofUrl: payment.paymentProofUrl,
        paymentProofName: payment.paymentProofName,
        createdAt: payment.createdAt,
        paidAt: payment.paidAt,
        confirmedBy: payment.confirmedBy,
        rejectionReason: payment.rejectionReason,
        invoiceNumber: payment.invoiceNumber,
        invoiceUrl: payment.invoiceUrl,
        bookingReference: payment.referenceId.slice(-8).toUpperCase(),
        airport: booking?.airport || null,
        arrivalDate: booking?.arrivalDate || null,
        arrivalTime: booking?.arrivalTime || null,
      };
    });

    const start = monthStart(new Date());
    const summary = {
      totalRevenue: data
        .filter((item) => item.status === ServicePayStatus.CONFIRMED)
        .reduce((sum, item) => sum + item.amount, 0),
      pendingTotal: data
        .filter((item) => item.status === ServicePayStatus.PENDING || item.status === ServicePayStatus.PROOF_UPLOADED)
        .reduce((sum, item) => sum + item.amount, 0),
      confirmedThisMonth: data
        .filter((item) => item.status === ServicePayStatus.CONFIRMED && item.paidAt && new Date(item.paidAt) >= start)
        .reduce((sum, item) => sum + item.amount, 0),
      rejectedTotal: data
        .filter((item) => item.status === ServicePayStatus.REJECTED)
        .reduce((sum, item) => sum + item.amount, 0),
    };

    return NextResponse.json({ data, summary });
  } catch (error) {
    console.error("[GET /api/admin/service-payments]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
