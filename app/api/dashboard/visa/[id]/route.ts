import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendResendEmail } from "@/lib/resend";
import * as templates from "@/lib/email-templates";

const patchSchema = z.object({
  status: z.enum(["PREPARING", "SUBMITTED", "APPROVED", "REJECTED"]).optional(),
  notes: z.string().optional(),
  appointmentDate: z.string().optional(),
  appointmentLocation: z.string().optional(),
  appointmentRef: z.string().optional(),
  checklist: z.any().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const visa = await db.visaApplication.findUnique({
      where: { applicationId: params.id },
      include: {
        student: { include: { user: true, subAgent: true } },
        application: { include: { university: true, course: true, counsellor: true } },
      },
    });

    if (!visa) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const logs = await db.activityLog.findMany({
      where: { entityType: "visa", entityId: visa.id },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ data: { visa, logs } });
  } catch (error) {
    console.error("Error fetching visa detail", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { email: session.user.email },
      include: { role: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const data = patchSchema.parse(body);

    // locate existing visa
    const existing = await db.visaApplication.findUnique({
      where: { applicationId: params.id },
      include: {
        student: true,
        application: { include: { course: true, university: true, counsellor: true } },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // update record
    const updated = await db.visaApplication.update({
      where: { applicationId: params.id },
      data: {
        status: data.status,
        notes: data.notes,
        appointmentDate: data.appointmentDate ? new Date(data.appointmentDate) : undefined,
        appointmentLocation: data.appointmentLocation,
        appointmentRef: data.appointmentRef,
        checklist: data.checklist,
      },
    });

    // log activity
    if (data.status) {
      await db.activityLog.create({
        data: {
          userId: user.id,
          entityType: "visa",
          entityId: existing.id,
          action: `status_changed_to_${data.status}`,
          details: data.notes || null,
        },
      });
    }
    if (data.appointmentDate || data.appointmentLocation || data.appointmentRef) {
      await db.activityLog.create({
        data: {
          userId: user.id,
          entityType: "visa",
          entityId: existing.id,
          action: "appointment_updated",
          details: null,
        },
      });
    }
    if (data.checklist) {
      await db.activityLog.create({
        data: {
          userId: user.id,
          entityType: "visa",
          entityId: existing.id,
          action: "checklist_updated",
          details: null,
        },
      });
    }

    // special side-effects
    if (data.status === "APPROVED" && existing.status !== "APPROVED") {
      // Stage 1: create pending commission shell (no amounts yet)
      try {
        const agreement = await db.universityCommissionAgreement.findFirst({
          where: { universityId: existing.application.universityId, isActive: true },
        });

        if (agreement) {
          await db.commission.upsert({
            where: { applicationId: existing.applicationId },
            create: {
              applicationId: existing.applicationId,
              universityAgreementId: agreement.id,
              tuitionFee: existing.application.course.tuitionFee || 0,
              universityCommRate: agreement.commissionRate,
              grossCommission: 0,
              currency: existing.application.university.currency || "",
              subAgentId: existing.student.subAgentId ?? null,
              agentRateAtTime: 0,
              agentAmount: 0,
              eduquanticaNet: 0,
              status: "PENDING_ARRIVAL",
              visaApprovedAt: new Date(),
            },
            update: {
              universityAgreementId: agreement.id,
              tuitionFee: existing.application.course.tuitionFee || 0,
              universityCommRate: agreement.commissionRate,
              currency: existing.application.university.currency || "",
              subAgentId: existing.student.subAgentId ?? null,
              status: "PENDING_ARRIVAL",
              visaApprovedAt: new Date(),
              agentRateAtTime: 0,
              agentAmount: 0,
              eduquanticaNet: 0,
              grossCommission: 0,
              calculatedAt: null,
            },
          });
        }

        await db.application.update({
          where: { id: existing.applicationId },
          data: {
            status: "VISA_APPLIED",
            visaSubStatus: "VISA_APPROVED",
            visaAppliedAt: new Date(),
          },
        });

        await db.activityLog.create({
          data: {
            userId: user.id,
            entityType: "commission",
            entityId: existing.applicationId,
            action: "stage_1_commission_created",
            details: `Stage 1 commission created for ${existing.student.firstName} ${existing.student.lastName}`,
          },
        });
      } catch (e) {
        console.error("Failed to create commission on visa approval", e);
      }

      // email student
      try {
        const studentUser = await db.user.findUnique({ where: { id: existing.student.userId } });
        if (studentUser?.email) {
          const tpl = templates.visaApproved(
            existing.student.firstName + " " + existing.student.lastName,
            existing.application.course.name,
            existing.application.university.name,
            existing.application.counsellor?.name || undefined,
          );
          await sendResendEmail({ to: studentUser.email, subject: tpl.subject, html: tpl.html });
        }
      } catch (e) {
        console.error("Failed to send visa approved email", e);
      }
      // notify sub-agent via activity log
      const subAgentId = existing.student.subAgentId;
      if (subAgentId) {
        const saUser = await db.user.findUnique({ where: { id: subAgentId } });
        if (saUser) {
          await db.activityLog.create({
            data: {
              userId: saUser.id,
              entityType: "visa",
              entityId: existing.id,
              action: "visa_approved",
              details: `Visa approved for ${existing.student.firstName} ${existing.student.lastName}`,
            },
          });
        }
      }
    }

    if (data.status === "REJECTED" && existing.status !== "REJECTED") {
      await db.application.update({
        where: { id: existing.applicationId },
        data: {
          status: "VISA_APPLIED",
          visaSubStatus: "VISA_REJECTED",
          visaAppliedAt: new Date(),
        },
      });
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("Error patching visa", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
