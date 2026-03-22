import { type ApplicationStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { NotificationService } from "@/lib/notifications";
import { APPLICATION_PIPELINE } from "@/lib/application-pipeline";

function statusIndex(status: ApplicationStatus): number {
  return APPLICATION_PIPELINE.indexOf(status);
}

async function moveStatusForward(input: {
  applicationId: string;
  targetStatus: ApplicationStatus;
  actorUserId?: string | null;
  action: string;
  details: string;
}) {
  const app = await db.application.findUnique({
    where: { id: input.applicationId },
    select: {
      id: true,
      status: true,
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          assignedCounsellorId: true,
          userId: true,
        },
      },
    },
  });

  if (!app) return null;
  if (app.status === "ENROLLED" || app.status === "WITHDRAWN") return null;
  if (statusIndex(app.status) >= statusIndex(input.targetStatus)) return null;

  const now = new Date();
  const updateData: Record<string, unknown> = { status: input.targetStatus };
  if (input.targetStatus === "DOCUMENTS_SUBMITTED") updateData.submittedAt = now;
  if (input.targetStatus === "FINANCE_IN_PROGRESS") {
    // status-only transition
  }
  if (input.targetStatus === "DEPOSIT_PAID") {
    // no-op extra fields
  }
  if (input.targetStatus === "FINANCE_COMPLETE") {
    updateData.financeCompleteAt = now;
  }

  const updated = await db.application.update({
    where: { id: app.id },
    data: updateData,
    select: {
      id: true,
      status: true,
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          assignedCounsellorId: true,
          userId: true,
        },
      },
    },
  });

  await db.activityLog.create({
    data: {
      userId: input.actorUserId || updated.student.assignedCounsellorId || updated.student.userId,
      entityType: "application",
      entityId: updated.id,
      action: input.action,
      details: input.details,
    },
  }).catch(() => undefined);

  return updated;
}

export async function triggerDocumentsSubmittedIfChecklistVerified(applicationId: string, actorUserId?: string) {
  const checklist = await db.documentChecklist.findFirst({
    where: { applicationId },
    include: {
      items: {
        where: { isRequired: true },
        select: { status: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!checklist || checklist.items.length === 0) return;
  const allVerified = checklist.items.every((item) => item.status === "VERIFIED");
  if (!allVerified) return;

  const updated = await moveStatusForward({
    applicationId,
    targetStatus: "DOCUMENTS_SUBMITTED",
    actorUserId,
    action: "auto_status_documents_submitted",
    details: "Automatically moved to DOCUMENTS_SUBMITTED after all checklist items were verified.",
  });

  if (updated?.student.assignedCounsellorId) {
    await NotificationService.createNotification({
      userId: updated.student.assignedCounsellorId,
      type: "APPLICATION_STATUS_AUTO_UPDATED",
      message: `All documents verified for ${updated.student.firstName} ${updated.student.lastName}.`,
      linkUrl: `/dashboard/applications/${updated.id}`,
      actorUserId,
    }).catch(() => undefined);
  }
}

export async function triggerFinanceInProgressFromFunding(applicationId: string, actorUserId?: string) {
  await moveStatusForward({
    applicationId,
    targetStatus: "FINANCE_IN_PROGRESS",
    actorUserId,
    action: "auto_status_finance_in_progress",
    details: "Automatically moved to FINANCE_IN_PROGRESS when first funding source was added.",
  });
}

export async function triggerDepositPaid(applicationId: string, actorUserId?: string) {
  await moveStatusForward({
    applicationId,
    targetStatus: "DEPOSIT_PAID",
    actorUserId,
    action: "auto_status_deposit_paid",
    details: "Automatically moved to DEPOSIT_PAID after deposit receipt approval.",
  });
}

export async function triggerFinanceComplete(applicationId: string, actorUserId?: string) {
  const updated = await moveStatusForward({
    applicationId,
    targetStatus: "FINANCE_COMPLETE",
    actorUserId,
    action: "auto_status_finance_complete",
    details: "Automatically moved to FINANCE_COMPLETE after declared funding met required amount.",
  });

  if (updated?.student.assignedCounsellorId) {
    await NotificationService.createNotification({
      userId: updated.student.assignedCounsellorId,
      type: "APPLICATION_STATUS_AUTO_UPDATED",
      message: `Finance complete for ${updated.student.firstName} ${updated.student.lastName} - ready for CAS.`,
      linkUrl: `/dashboard/applications/${updated.id}`,
      actorUserId,
    }).catch(() => undefined);
  }
}
