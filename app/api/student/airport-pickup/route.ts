import { PickupStatus, ServicePaymentType, ServicePayStatus } from "@prisma/client";
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

const bookingSchema = z.object({
  studentId: z.string().trim().optional(),
  destinationCity: z.string().trim().min(1),
  destinationCountry: z.string().trim().min(1),
  airport: z.string().trim().min(1),
  terminal: z.string().trim().optional().nullable(),
  flightNumber: z.string().trim().min(1),
  departureCountry: z.string().trim().min(1),
  departureCity: z.string().trim().min(1),
  departureDate: z.string().min(1),
  departureTime: z.string().trim().min(1),
  arrivalDate: z.string().min(1),
  arrivalTime: z.string().trim().min(1),
  passengerCount: z.number().int().positive().default(1),
  specialRequirements: z.string().trim().optional().nullable(),
  ticketConfirmationUrl: z.string().trim().min(1),
  ticketFileName: z.string().trim().min(1),
  paymentMethod: z.enum(["BANK_TRANSFER", "IN_PERSON", "ONLINE"]),
  paymentProofUrl: z.string().trim().optional().nullable(),
  paymentProofName: z.string().trim().optional().nullable(),
});

function asDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function resolveStudentId(sessionUserId: string, roleName: string, requestedStudentId?: string) {
  if (roleName === "STUDENT") {
    const student = await db.student.findUnique({ where: { userId: sessionUserId }, select: { id: true } });
    return student?.id || null;
  }
  if (requestedStudentId) return requestedStudentId;
  return null;
}

function canAccess(roleName?: string) {
  return Boolean(roleName);
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !canAccess(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const studentId = await resolveStudentId(
      session.user.id,
      session.user.roleName,
      request.nextUrl.searchParams.get("studentId") || undefined,
    );

    if (session.user.roleName === "STUDENT" && !studentId) {
      return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
    }

    const bookings = await db.airportPickupBooking.findMany({
      where: studentId ? { studentId } : {},
      orderBy: [{ createdAt: "desc" }],
    });

    const studentIds = Array.from(new Set(bookings.map((booking) => booking.studentId)));
    const bookingIds = bookings.map((booking) => booking.id);
    const [students, payments] = await Promise.all([
      studentIds.length
        ? db.student.findMany({
            where: { id: { in: studentIds } },
            select: { id: true, firstName: true, lastName: true, email: true },
          })
        : Promise.resolve([]),
      bookingIds.length
        ? db.servicePayment.findMany({
            where: {
              serviceType: ServicePaymentType.AIRPORT_PICKUP,
              referenceId: { in: bookingIds },
            },
            orderBy: { createdAt: "desc" },
          })
        : Promise.resolve([]),
    ]);

    const studentMap = new Map(students.map((student) => [student.id, student]));
    const paymentMap = new Map(payments.map((payment) => [payment.referenceId, payment]));

    return NextResponse.json({
      data: bookings.map((booking) => {
        const student = studentMap.get(booking.studentId);
        const payment = paymentMap.get(booking.id);
        return {
          ...booking,
          studentName: student ? `${student.firstName} ${student.lastName}` : booking.studentId,
          studentEmail: student?.email || null,
          bookingReference: booking.id.slice(-8).toUpperCase(),
          paymentStatus: payment?.status || null,
          paymentMethod: payment?.paymentMethod || null,
          paymentProofUrl: payment?.paymentProofUrl || null,
          paymentProofName: payment?.paymentProofName || null,
          invoiceUrl: payment?.invoiceUrl || null,
          rejectionReason: payment?.rejectionReason || null,
          amount: payment?.amount || null,
          currency: payment?.currency || null,
        };
      }),
    });
  } catch (error) {
    console.error("[GET /api/student/airport-pickup]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !canAccess(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const parsed = bookingSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }

    const studentId = await resolveStudentId(session.user.id, session.user.roleName, parsed.data.studentId);
    if (!studentId) {
      return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
    }

    const departureDate = asDate(parsed.data.departureDate);
    const arrivalDate = asDate(parsed.data.arrivalDate);
    if (!departureDate || !arrivalDate) {
      return NextResponse.json({ error: "Invalid travel dates" }, { status: 400 });
    }

    const pricing = await db.servicePricing.findFirst({
      where: {
        serviceType: ServicePaymentType.AIRPORT_PICKUP,
        isActive: true,
        OR: [
          { airport: { equals: parsed.data.airport, mode: "insensitive" } },
          { name: { equals: parsed.data.airport, mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    const paymentStatus = parsed.data.paymentMethod === "BANK_TRANSFER"
      ? ServicePayStatus.PROOF_UPLOADED
      : ServicePayStatus.PENDING;

    const booking = await db.airportPickupBooking.create({
      data: {
        studentId,
        destinationCity: parsed.data.destinationCity,
        destinationCountry: parsed.data.destinationCountry,
        airport: parsed.data.airport,
        terminal: parsed.data.terminal || null,
        flightNumber: parsed.data.flightNumber,
        departureCountry: parsed.data.departureCountry,
        departureCity: parsed.data.departureCity,
        departureDate,
        departureTime: parsed.data.departureTime,
        arrivalDate,
        arrivalTime: parsed.data.arrivalTime,
        ticketConfirmationUrl: parsed.data.ticketConfirmationUrl,
        ticketFileName: parsed.data.ticketFileName,
        passengerCount: parsed.data.passengerCount,
        specialRequirements: parsed.data.specialRequirements || null,
        status: PickupStatus.PENDING,
      },
    });

    await db.servicePayment.create({
      data: {
        studentId,
        serviceType: ServicePaymentType.AIRPORT_PICKUP,
        referenceId: booking.id,
        description: `Airport pickup booking for ${parsed.data.airport}`,
        amount: pricing?.amount || 0,
        currency: pricing?.currency || "GBP",
        status: paymentStatus,
        paymentMethod: parsed.data.paymentMethod,
        paymentProofUrl: parsed.data.paymentProofUrl || null,
        paymentProofName: parsed.data.paymentProofName || null,
      },
    });

    const student = await db.student.findUnique({
      where: { id: studentId },
      select: {
        firstName: true,
        lastName: true,
        assignedCounsellorId: true,
      },
    });

    const adminUsers = await db.user.findMany({
      where: {
        role: {
          name: "ADMIN",
        },
      },
      select: { id: true },
    });

    const studentName = student
      ? `${student.firstName} ${student.lastName}`.trim()
      : "Student";
    const notifyUserIds = Array.from(new Set([
      ...adminUsers.map((user) => user.id),
      student?.assignedCounsellorId || "",
    ].filter(Boolean)));
    const arrivalDateLabel = arrivalDate.toISOString().split("T")[0];
    const bookingMessage = `New airport pickup booking from ${studentName}. Flight ${parsed.data.flightNumber} arriving at ${parsed.data.airport} on ${arrivalDateLabel}. Please verify payment and confirm.`;

    await Promise.all(
      notifyUserIds.map((userId) =>
        NotificationService.createNotification({
          userId,
          type: "AIRPORT_PICKUP_BOOKING_CREATED",
          message: bookingMessage,
          linkUrl: "/dashboard/student-services",
          actorUserId: session.user.id,
        }).catch(() => undefined),
      ),
    );

    if (parsed.data.paymentProofUrl) {
      await sendResendEmail({
        to: process.env.ADMIN_INBOX_EMAIL || "admin@eduquantica.com",
        subject: "Payment Proof Submitted - Airport Pickup",
        html: `<p>${studentName} submitted airport pickup payment proof.</p><p>Booking reference: ${booking.id.slice(-8).toUpperCase()}</p><p>Airport: ${parsed.data.airport}</p><p>Please review in dashboard.</p>`,
      }).catch(() => undefined);
    }

    return NextResponse.json({
      data: {
        id: booking.id,
        bookingReference: booking.id.slice(-8).toUpperCase(),
        status: booking.status,
        paymentStatus,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/student/airport-pickup]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}