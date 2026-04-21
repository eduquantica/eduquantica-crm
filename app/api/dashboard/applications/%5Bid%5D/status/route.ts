import { getServerSession } from "next-auth/next";
import { ApplicationStatus, type VisaSubStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as templates from "@/lib/email-templates";
import { sendResendEmail } from "@/lib/resend";
import { CommissionService } from "@/lib/commission";
import { ChecklistService } from "@/lib/checklist";
import { NotificationService } from "@/lib/notifications";
import { authOptions } from "@/lib/auth";
import { calculateSubAgentTier } from "@/lib/subagent-tier";
import { isApplicationFeeCleared } from "@/lib/application-fees";
import {
  APPLICATION_PIPELINE,
  APPLICATION_STATUS_LABELS,
  COUNSELLOR_ALLOWED_STATUSES,
  SUB_AGENT_ALLOWED_STATUSES,
  statusIndex,
  requiresNotes,
} from "@/lib/application-pipeline";
import {
  ensureApplicationMilestones,
  isMilestoneComplete,
  milestoneForStatus,
  requiredMilestonesForStatus,
} from "@/lib/application-milestones";

const updateStatusSchema = z.object({
  status: z.enum(APPLICATION_PIPELINE as [ApplicationStatus, ...ApplicationStatus[]]),
  notes: z.string().optional(),
  offerConditions: z.string().optional(),
  casNumber: z.string().optional(),
  visaApplicationRef: z.string().optional(),
  visaVignetteRef: z.string().optional(),
  visaSubStatus: z.enum(["VISA_PENDING", "VISA_APPROVED", "VISA_REJECTED"]).optional(),
  visaRejectionReason: z.string().optional(),
  withdrawalReason: z.string().optional(),
  offerLetterFileName: z.string().optional(),
  offerLetterFileUrl: z.string().optional(),
});

function canUpdateStatus(roleName?: string) {
  return roleName === "ADMIN" || roleName === "MANAGER" || roleName === "COUNSELLOR" || roleName === "SUB_AGENT";
}

function isStatusAllowedForRole(roleName: string, status: ApplicationStatus) {
  if (roleName === "ADMIN" || roleName === "MANAGER") return true;
  if (roleName === "COUNSELLOR") return COUNSELLOR_ALLOWED_STATUSES.includes(status);
  if (roleName === "SUB_AGENT") return SUB_AGENT_ALLOWED_STATUSES.includes(status);
  return false;
}

async function upsertCommissionForEnrolment(applicationId: string, confirmedBy: string) {
  const application = await db.application.findUnique({
    where: { id: applicationId },
    include: {
      student: {
        include: {
          subAgent: {
            include: { user: true },
          },
        },
      },
      course: true,
    },
  });

  if (!application) return;

  const agreement = await db.universityCommissionAgreement.findFirst({
    where: { universityId: application.universityId, isActive: true },
    select: { id: true, commissionRate: true },
  });

  if (!agreement) return;

  const breakdown = await CommissionService.calculateCommission(application.id);

  await db.commission.upsert({
    where: { applicationId: application.id },
    create: {
      applicationId: application.id,
      universityAgreementId: agreement.id,
      tuitionFee: application.course.tuitionFee ?? 0,
      universityCommRate: agreement.commissionRate,
      grossCommission: breakdown.grossCommission,
      currency: application.course.currency || "GBP",
      subAgentId: application.student.subAgentId,
      agentRateAtTime: breakdown.agentRate,
      agentAmount: breakdown.agentAmount,
      eduquanticaNet: breakdown.eduquanticaNet,
      status: "CALCULATED",
      calculatedAt: new Date(),
      enrolmentConfirmedAt: new Date(),
      confirmedBy,
    },
    update: {
      universityAgreementId: agreement.id,
      tuitionFee: application.course.tuitionFee ?? 0,
      universityCommRate: agreement.commissionRate,
      grossCommission: breakdown.grossCommission,
      currency: application.course.currency || "GBP",
      subAgentId: application.student.subAgentId,
      agentRateAtTime: breakdown.agentRate,
      agentAmount: breakdown.agentAmount,
      eduquanticaNet: breakdown.eduquanticaNet,
      status: "CALCULATED",
      calculatedAt: new Date(),
      enrolmentConfirmedAt: new Date(),
      confirmedBy,
    },
  });

  if (application.student.subAgentId && application.student.subAgent) {
    await CommissionService.updateTierAfterEnrolment(application.student.subAgentId).catch(() => undefined);
    await calculateSubAgentTier(application.student.subAgentId).catch(() => undefined);

    await NotificationService.createNotification({
      userId: application.student.subAgent.userId,
      type: "COMMISSION_CALCULATED",
      message: `Your commission for ${application.student.firstName} ${application.student.lastName} has been calculated.`,
      linkUrl: "/agent/commissions",
      actorUserId: confirmedBy,
    }).catch(() => undefined);
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

    // Get user with role
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      include: { role: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const payload = updateStatusSchema.parse(body);

    if (!canUpdateStatus(user.role.name)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!isStatusAllowedForRole(user.role.name, payload.status)) {
      return NextResponse.json({ error: "You are not allowed to set this status" }, { status: 403 });
    }

    const isAdminOrManager = user.role.name === "ADMIN" || user.role.name === "MANAGER";

    if (!isAdminOrManager) {
      if (requiresNotes(payload.status, payload.visaSubStatus as VisaSubStatus | undefined) && !payload.notes?.trim()) {
        return NextResponse.json({ error: "Notes are required for this status" }, { status: 400 });
      }

      if (payload.status === "CONDITIONAL_OFFER" && !payload.offerConditions?.trim()) {
        return NextResponse.json({ error: "Offer conditions are required" }, { status: 400 });
      }

      if (payload.status === "CAS_ISSUED" && !payload.casNumber?.trim()) {
        return NextResponse.json({ error: "CAS number is required" }, { status: 400 });
      }

      if (payload.status === "VISA_APPLIED" && payload.visaSubStatus === "VISA_REJECTED" && !payload.visaRejectionReason?.trim()) {
        return NextResponse.json({ error: "Visa rejection reason is required" }, { status: 400 });
      }

      if (payload.status === "WITHDRAWN" && !payload.withdrawalReason?.trim()) {
        return NextResponse.json({ error: "Withdrawal reason is required" }, { status: 400 });
      }
    }

    if (!isAdminOrManager && payload.status !== "APPLIED" && payload.status !== "WITHDRAWN") {
      const feeCleared = await isApplicationFeeCleared(params.id);
      if (!feeCleared) {
        return NextResponse.json(
          { error: "Application fee must be PAID or WAIVED before progressing beyond APPLIED." },
          { status: 400 },
        );
      }
    }

    // Get current application
    const application = await db.application.findUnique({
      where: { id: params.id },
      include: {
        student: {
          include: {
            subAgent: true,
          },
        },
      },
    });

    if (!application) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    // If counsellor, check they're assigned to the student
    if (user.role.name === "COUNSELLOR") {
      if (application.student.assignedCounsellorId !== user.id) {
        return NextResponse.json(
          { error: "Forbidden" },
          { status: 403 }
        );
      }
    }

    if (user.role.name === "SUB_AGENT") {
      if (application.student.subAgent?.userId !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const currentStatusIndex = statusIndex(application.status);
    const targetStatusIndex = statusIndex(payload.status);
    if (!isAdminOrManager && targetStatusIndex > currentStatusIndex + 1 && payload.status !== "WITHDRAWN") {
      return NextResponse.json({ error: "Status must follow timeline sequence" }, { status: 400 });
    }

    const now = new Date();
    const updateData: Record<string, unknown> = {
      status: payload.status,
      offerConditions: payload.status === "CONDITIONAL_OFFER" ? payload.offerConditions?.trim() || null : application.offerConditions,
      casNumber: payload.status === "CAS_ISSUED" ? payload.casNumber?.trim() || null : application.casNumber,
      visaApplicationRef: payload.status === "VISA_APPLIED" ? payload.visaApplicationRef?.trim() || null : application.visaApplicationRef,
      visaVignetteRef: payload.status === "VISA_APPLIED" ? payload.visaVignetteRef?.trim() || null : application.visaVignetteRef,
      visaSubStatus:
        payload.status === "VISA_APPLIED"
          ? ((payload.visaSubStatus || application.visaSubStatus || "VISA_PENDING") as VisaSubStatus)
          : null,
      visaRejectionReason:
        payload.status === "VISA_APPLIED" && payload.visaSubStatus === "VISA_REJECTED"
          ? payload.visaRejectionReason?.trim() || null
          : payload.status === "VISA_APPLIED"
            ? null
            : application.visaRejectionReason,
      withdrawalReason: payload.status === "WITHDRAWN" ? payload.withdrawalReason?.trim() || null : application.withdrawalReason,
      submittedToUniversityAt: payload.status === "SUBMITTED_TO_UNIVERSITY" ? now : application.submittedToUniversityAt,
      conditionalOfferAt: payload.status === "CONDITIONAL_OFFER" ? now : application.conditionalOfferAt,
      unconditionalOfferAt: payload.status === "UNCONDITIONAL_OFFER" ? now : application.unconditionalOfferAt,
      financeCompleteAt: payload.status === "FINANCE_COMPLETE" ? now : application.financeCompleteAt,
      casIssuedAt: payload.status === "CAS_ISSUED" ? now : application.casIssuedAt,
      visaAppliedAt: payload.status === "VISA_APPLIED" ? now : application.visaAppliedAt,
      enrolledAt: payload.status === "ENROLLED" ? now : application.enrolledAt,
      withdrawnAt: payload.status === "WITHDRAWN" ? now : application.withdrawnAt,
      submittedAt: payload.status === "SUBMITTED_TO_UNIVERSITY" ? now : application.submittedAt,
      offerReceivedAt:
        payload.status === "CONDITIONAL_OFFER" || payload.status === "UNCONDITIONAL_OFFER"
          ? now
          : application.offerReceivedAt,
    };

    const updated = await db.$transaction(async (tx) => {
      await ensureApplicationMilestones(tx, params.id);

      await tx.applicationMilestoneDocument.update({
        where: {
          applicationId_milestone: {
            applicationId: params.id,
            milestone: "APPLICATION_SUBMISSION",
          },
        },
        data: {
          status: "VERIFIED",
          verifiedAt: now,
          verifiedById: user.id,
        },
      }).catch(() => undefined);

      const requiredMilestones = requiredMilestonesForStatus(payload.status);
      if (requiredMilestones.length > 0) {
        const existingMilestones = await tx.applicationMilestoneDocument.findMany({
          where: {
            applicationId: params.id,
            milestone: { in: requiredMilestones },
          },
          select: {
            milestone: true,
            status: true,
          },
        });

        const incomplete = existingMilestones.find((row) => !isMilestoneComplete(row.status));
        if (incomplete) {
          throw new Error(`Required milestone document is missing for ${incomplete.milestone.replaceAll("_", " ")}`);
        }
      }

      const next = await tx.application.update({
        where: { id: params.id },
        data: updateData,
        include: {
          student: {
            include: {
              subAgent: true,
            },
          },
          course: {
            include: {
              university: true,
            },
          },
          counsellor: true,
        },
      });

      const currentMilestone = milestoneForStatus(payload.status);
      if (currentMilestone) {
        await tx.applicationMilestoneDocument.update({
          where: {
            applicationId_milestone: {
              applicationId: params.id,
              milestone: currentMilestone,
            },
          },
          data: {
            status: "VERIFIED",
            verifiedAt: now,
            verifiedById: user.id,
            notes: payload.notes?.trim() || undefined,
          },
        }).catch(() => undefined);
      }

      return next;
    });

    if (payload.status === "UNCONDITIONAL_OFFER" && application.status !== "UNCONDITIONAL_OFFER") {
      await ChecklistService.generateChecklist(updated.id);
    }

    if (payload.status === "UNCONDITIONAL_OFFER" && payload.offerLetterFileUrl?.trim()) {
      await db.activityLog.create({
        data: {
          userId: user.id,
          entityType: "application",
          entityId: updated.id,
          action: "offer_letter_uploaded_from_status_modal",
          details: JSON.stringify({
            fileName: payload.offerLetterFileName || null,
            fileUrl: payload.offerLetterFileUrl,
            uploadedAt: now.toISOString(),
          }),
        },
      }).catch(() => undefined);
    }

    // Log activity
    await db.activityLog.create({
      data: {
        userId: user.id,
        entityType: "application",
        entityId: updated.id,
        action: "status_change",
        details: JSON.stringify({
          fromStatus: application.status,
          toStatus: payload.status,
          notes: payload.notes || null,
          visaSubStatus: payload.status === "VISA_APPLIED" ? (payload.visaSubStatus || updated.visaSubStatus || "VISA_PENDING") : null,
          changedAt: now.toISOString(),
        }),
      },
    });

    const studentName = `${updated.student.firstName} ${updated.student.lastName}`.trim();
    const baseLink = `/dashboard/applications/${updated.id}`;

    await NotificationService.createNotification({
      userId: updated.student.userId,
      type: "APPLICATION_STATUS_CHANGED",
      message: `Your application status changed to ${APPLICATION_STATUS_LABELS[payload.status]}.`,
      linkUrl: `/student/applications/${updated.id}`,
      actorUserId: user.id,
    }).catch(() => undefined);

    if (updated.counsellorId && updated.counsellorId !== user.id) {
      await NotificationService.createNotification({
        userId: updated.counsellorId,
        type: "APPLICATION_STATUS_CHANGED",
        message: `${studentName}'s application moved to ${APPLICATION_STATUS_LABELS[payload.status]}.`,
        linkUrl: baseLink,
        actorUserId: user.id,
      }).catch(() => undefined);
    }

    if (updated.student?.subAgent?.userId) {
      await NotificationService.createNotification({
        userId: updated.student.subAgent.userId,
        type: "APPLICATION_STATUS_CHANGED",
        message: `${studentName}'s application moved to ${APPLICATION_STATUS_LABELS[payload.status]}.`,
        linkUrl: `/agent/students/${updated.studentId}`,
        actorUserId: user.id,
      }).catch(() => undefined);
    }

    if (user.role.name === "SUB_AGENT") {
      if (updated.student.assignedCounsellorId) {
        await NotificationService.createNotification({
          userId: updated.student.assignedCounsellorId,
          type: "SUB_AGENT_STATUS_UPDATED",
          message: `${user.name || user.email} updated ${studentName} application to ${APPLICATION_STATUS_LABELS[payload.status]}.`,
          linkUrl: `/dashboard/applications/${updated.id}`,
          actorUserId: user.id,
        }).catch(() => undefined);
      }

      const adminUsers = await db.user.findMany({
        where: { role: { name: { in: ["ADMIN", "MANAGER"] } }, isActive: true },
        select: { id: true },
      });

      await Promise.all(
        adminUsers.map((admin) =>
          NotificationService.createNotification({
            userId: admin.id,
            type: "SUB_AGENT_STATUS_UPDATED",
            message: `${user.name || user.email} updated ${studentName} application to ${APPLICATION_STATUS_LABELS[payload.status]}.`,
            linkUrl: `/dashboard/applications/${updated.id}`,
            actorUserId: user.id,
          }).catch(() => undefined),
        ),
      );
    }

    if (payload.status === "ENROLLED") {
      await upsertCommissionForEnrolment(updated.id, user.id).catch((error) => {
        console.error("Failed to calculate commission on enrolment", error);
      });

      if (updated.student.subAgentId) {
        await calculateSubAgentTier(updated.student.subAgentId).catch((error) => {
          console.error("Failed to recalculate sub-agent tier on enrolled status", error);
        });
      }
    }

    // Send templated emails depending on status
    try {
      const student = await db.student.findUnique({ where: { id: updated.studentId }, include: { user: true } });
      const counsellor = updated.counsellor;
      const subAgent = updated.student?.subAgent;

      if (student && student.email) {
        const tpl = templates.applicationStatusEmail(
          payload.status,
          `${student.firstName} ${student.lastName}`,
          updated.course.name,
          updated.course.university.name,
          {
            counsellorName: counsellor?.name ?? undefined,
            visaSubStatus: updated.visaSubStatus || undefined,
            offerConditions: updated.offerConditions || undefined,
            casNumber: updated.casNumber || undefined,
            withdrawalReason: updated.withdrawalReason || undefined,
          },
        );

        if (tpl) {
          await sendResendEmail({ to: student.email, subject: tpl.subject, html: tpl.html });
          await db.activityLog.create({ data: { userId: user.id, entityType: 'application', entityId: updated.id, action: 'email_sent', details: `Email sent to ${student.firstName} ${student.lastName}: ${tpl.subject}` } });
        }

        // Notify counsellor for sensitive status updates
        if (counsellor && (payload.status === 'UNCONDITIONAL_OFFER' || payload.status === 'WITHDRAWN' || payload.status === 'ENROLLED')) {
          if (counsellor.email) {
            const ctpl = { subject: `Application ${updated.id} status: ${payload.status}`, html: `<p>Student: ${student.firstName} ${student.lastName}<br/>Status: ${APPLICATION_STATUS_LABELS[payload.status]}</p>` };
            await sendResendEmail({ to: counsellor.email, subject: ctpl.subject, html: ctpl.html });
            await db.activityLog.create({ data: { userId: user.id, entityType: 'application', entityId: updated.id, action: 'email_sent', details: `Email sent to counsellor ${counsellor.name}: ${ctpl.subject}` } });
          }
        }

        // Notify sub-agent if present
        if (subAgent && subAgent.userId) {
          await db.activityLog.create({
            data: {
              userId: subAgent.userId,
              entityType: 'application',
              entityId: updated.id,
              action: 'status_updated',
              details: `Application status changed to ${payload.status} for ${student.firstName} ${student.lastName}`,
            },
          });

          const sa = await db.user.findUnique({ where: { id: subAgent.userId } });
          if (sa && sa.email) {
            const sAtpl = { subject: `Application ${updated.id} status: ${payload.status}`, html: `<p>Student: ${student.firstName} ${student.lastName}<br/>Status: ${APPLICATION_STATUS_LABELS[payload.status]}</p>` };
            await sendResendEmail({ to: sa.email, subject: sAtpl.subject, html: sAtpl.html });
            await db.activityLog.create({ data: { userId: user.id, entityType: 'application', entityId: updated.id, action: 'email_sent', details: `Email sent to sub-agent ${sa.email}: ${sAtpl.subject}` } });
          }
        }
      }
    } catch (err) {
      console.error('Error sending status emails', err);
    }
    return NextResponse.json({ data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    if (error instanceof Error && error.message.startsWith("Required milestone document")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error updating application status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
