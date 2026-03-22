import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { randomUUID } from "crypto";
import { ensurePostEnrolmentService, notifyLinkedSubAgent } from "@/lib/post-enrolment";
import { sendResendEmail } from "@/lib/resend";

const updateSchema = z.object({
  accommodationStatus: z.enum(["NOT_ARRANGED", "IN_PROGRESS", "CONFIRMED"]).optional(),
  accommodationType: z.enum(["UNIVERSITY_HALLS", "PRIVATE", "HOMESTAY", "OTHER"]).optional().nullable(),
  accommodationAddress: z.string().optional().nullable(),
  accommodationMoveInDate: z.string().optional().nullable(),
  accommodationNotes: z.string().optional().nullable(),

  airportRequired: z.boolean().optional(),
  airportStatus: z.enum(["NOT_REQUIRED", "ARRANGED", "CONFIRMED"]).optional(),
  airportArrivalDateTime: z.string().optional().nullable(),
  airportFlightNumber: z.string().optional().nullable(),
  airportPickupArrangedBy: z.string().optional().nullable(),
  airportContactNumber: z.string().optional().nullable(),
  airportNotes: z.string().optional().nullable(),

  briefingStatus: z.enum(["NOT_SCHEDULED", "SCHEDULED", "COMPLETED"]).optional(),
  briefingDateTime: z.string().optional().nullable(),
  briefingNotes: z.string().optional().nullable(),

  sendFeedbackForm: z.boolean().optional(),
});

function parseDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { applicationId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const application = await db.application.findUnique({
      where: { id: params.applicationId },
      include: {
        student: {
          include: {
            subAgent: {
              include: { user: true },
            },
          },
        },
        university: true,
        course: true,
        counsellor: true,
      },
    });

    if (!application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const service = await ensurePostEnrolmentService(params.applicationId);

    return NextResponse.json({
      data: {
        application: {
          id: application.id,
          status: application.status,
          student: {
            id: application.student.id,
            firstName: application.student.firstName,
            lastName: application.student.lastName,
            email: application.student.email,
            subAgentId: application.student.subAgentId,
            subAgentEmail: application.student.subAgent?.user?.email || null,
          },
          university: application.university.name,
          course: application.course.name,
          counsellor: application.counsellor
            ? { id: application.counsellor.id, name: application.counsellor.name, email: application.counsellor.email }
            : null,
        },
        service,
      },
    });
  } catch (error) {
    console.error("Error fetching student service detail", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { applicationId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await db.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const body = await req.json();
    const payload = updateSchema.parse(body);

    const application = await db.application.findUnique({
      where: { id: params.applicationId },
      include: { student: true, counsellor: true },
    });
    if (!application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const service = await ensurePostEnrolmentService(params.applicationId);

    let feedbackToken = service.feedbackToken;
    let feedbackStatus = service.feedbackStatus;
    let feedbackSentAt = service.feedbackSentAt;

    if (payload.sendFeedbackForm) {
      feedbackToken = feedbackToken || randomUUID().replace(/-/g, "");
      feedbackStatus = "SENT";
      feedbackSentAt = new Date();

      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
      const feedbackLink = `${baseUrl}/feedback/${feedbackToken}`;

      await sendResendEmail({
        to: application.student.email,
        subject: "We value your feedback - EduQuantica",
        html: `<p>Hi ${application.student.firstName},</p><p>Thank you for enrolling with EduQuantica.</p><p>Please share your feedback using this form: <a href="${feedbackLink}">${feedbackLink}</a></p>`,
      });
    }

    const nextAirportRequired = payload.airportRequired ?? service.airportRequired;

    const updated = await db.postEnrolmentService.update({
      where: { id: service.id },
      data: {
        accommodationStatus: payload.accommodationStatus,
        accommodationType: payload.accommodationType === undefined ? undefined : payload.accommodationType,
        accommodationAddress: payload.accommodationAddress === undefined ? undefined : payload.accommodationAddress,
        accommodationMoveInDate:
          payload.accommodationMoveInDate === undefined
            ? undefined
            : parseDate(payload.accommodationMoveInDate),
        accommodationNotes: payload.accommodationNotes === undefined ? undefined : payload.accommodationNotes,

        airportRequired: payload.airportRequired,
        airportStatus:
          payload.airportStatus ||
          (nextAirportRequired ? service.airportStatus : "NOT_REQUIRED"),
        airportArrivalDateTime:
          payload.airportArrivalDateTime === undefined
            ? undefined
            : parseDate(payload.airportArrivalDateTime),
        airportFlightNumber:
          payload.airportFlightNumber === undefined ? undefined : payload.airportFlightNumber,
        airportPickupArrangedBy:
          payload.airportPickupArrangedBy === undefined ? undefined : payload.airportPickupArrangedBy,
        airportContactNumber:
          payload.airportContactNumber === undefined ? undefined : payload.airportContactNumber,
        airportNotes: payload.airportNotes === undefined ? undefined : payload.airportNotes,

        briefingStatus: payload.briefingStatus,
        briefingDateTime:
          payload.briefingDateTime === undefined ? undefined : parseDate(payload.briefingDateTime),
        briefingNotes: payload.briefingNotes === undefined ? undefined : payload.briefingNotes,

        feedbackToken,
        feedbackStatus,
        feedbackSentAt,
      },
    });

    if (payload.briefingDateTime) {
      const briefingDate = parseDate(payload.briefingDateTime);
      if (briefingDate) {
        await sendResendEmail({
          to: application.student.email,
          subject: "Pre-departure briefing scheduled",
          html: `<p>Hi ${application.student.firstName},</p><p>Your pre-departure briefing has been scheduled for <strong>${briefingDate.toLocaleString("en-GB")}</strong>.</p><p>Please add this to your calendar.</p>`,
        });
      }
    }

    await db.activityLog.create({
      data: {
        userId: user.id,
        entityType: "post_enrolment",
        entityId: updated.id,
        action: "post_enrolment_updated",
        details: "Post-enrolment service details updated",
      },
    });

    await notifyLinkedSubAgent(
      application.studentId,
      `Post-enrolment details were updated for ${application.student.firstName} ${application.student.lastName}.`,
      user.id,
    );

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("Error updating student service detail", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
