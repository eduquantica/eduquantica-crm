import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { PickupStatus, ServicePaymentType } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

function canRead(roleName?: string) {
  return roleName === "ADMIN" || roleName === "MANAGER" || roleName === "COUNSELLOR";
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !canRead(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const status = request.nextUrl.searchParams.get("status") || "";
    const destinationCountry = request.nextUrl.searchParams.get("destinationCountry")?.trim() || "";
    const from = request.nextUrl.searchParams.get("from") || "";
    const to = request.nextUrl.searchParams.get("to") || "";

    const bookings = await db.airportPickupBooking.findMany({
      where: {
        ...(status && Object.values(PickupStatus).includes(status as PickupStatus) ? { status: status as PickupStatus } : {}),
        ...(destinationCountry ? { destinationCountry: { contains: destinationCountry, mode: "insensitive" } } : {}),
        ...(from || to
          ? {
              arrivalDate: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ arrivalDate: "asc" }, { arrivalTime: "asc" }],
    });

    const studentIds = Array.from(new Set(bookings.map((item) => item.studentId)));
    const bookingIds = bookings.map((item) => item.id);
    const [students, payments] = await Promise.all([
      studentIds.length
        ? db.student.findMany({
            where: { id: { in: studentIds } },
            select: { id: true, firstName: true, lastName: true, email: true, phone: true },
          })
        : Promise.resolve([]),
      bookingIds.length
        ? db.servicePayment.findMany({
            where: {
              serviceType: ServicePaymentType.AIRPORT_PICKUP,
              referenceId: { in: bookingIds },
            },
            select: { referenceId: true, status: true, paymentProofUrl: true, paymentProofName: true },
          })
        : Promise.resolve([]),
    ]);

    const studentMap = new Map(students.map((student) => [student.id, student]));
    const paymentMap = new Map(payments.map((payment) => [payment.referenceId, payment]));

    const data = bookings.map((item) => {
      const student = studentMap.get(item.studentId);
      const payment = paymentMap.get(item.id);
      return {
        ...item,
        studentName: student ? `${student.firstName} ${student.lastName}` : item.studentId,
        studentEmail: student?.email || null,
        studentPhone: student?.phone || null,
        paymentStatus: payment?.status || null,
        paymentProofUrl: payment?.paymentProofUrl || null,
        paymentProofName: payment?.paymentProofName || null,
      };
    });

    return NextResponse.json({ data });
  } catch (error) {
    console.error("[GET /api/admin/airport-pickup]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}