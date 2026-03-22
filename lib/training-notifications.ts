import { db } from "@/lib/db";
import { NotificationService } from "@/lib/notifications";
import { sendResendEmail } from "@/lib/resend";
import { resolveOrganisationForUser } from "@/lib/training";

type TriggerType = "THIRTY_DAYS" | "ON_EXPIRY";

function triggerAction(trigger: TriggerType) {
  return trigger === "THIRTY_DAYS" ? "training_expiry_notify_30_days" : "training_expiry_notify_on_expiry";
}

async function notificationAlreadySent(recordId: string, trigger: TriggerType) {
  const existing = await db.activityLog.findFirst({
    where: {
      entityType: "training_record",
      entityId: recordId,
      action: triggerAction(trigger),
    },
    select: { id: true },
  });

  return !!existing;
}

export async function sendTrainingExpiryNotifications(recordId: string, trigger: TriggerType) {
  if (await notificationAlreadySent(recordId, trigger)) return { sent: false, reason: "already_sent" as const };

  const record = await db.trainingRecord.findUnique({
    where: { id: recordId },
    select: {
      id: true,
      expiryDate: true,
      userId: true,
      training: {
        select: {
          name: true,
          organisationType: true,
          organisationId: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: { select: { name: true } },
        },
      },
    },
  });

  if (!record || !record.expiryDate) return { sent: false, reason: "no_record_or_expiry" as const };

  const org = await resolveOrganisationForUser(record.userId);
  const roleName = record.user.role.name;

  const recipients = new Set<string>();
  recipients.add(record.userId);

  if (record.training.organisationType === "EDUQUANTICA" || !org.isSubAgentOrganisation) {
    if (roleName === "COUNSELLOR") {
      const [admins, managers] = await Promise.all([
        db.user.findMany({ where: { role: { name: "ADMIN" }, isActive: true }, select: { id: true } }),
        db.user.findMany({ where: { role: { name: "MANAGER" }, isActive: true }, select: { id: true } }),
      ]);
      for (const row of admins) recipients.add(row.id);
      for (const row of managers) recipients.add(row.id);
    } else if (roleName === "MANAGER") {
      const admins = await db.user.findMany({ where: { role: { name: "ADMIN" }, isActive: true }, select: { id: true } });
      for (const row of admins) recipients.add(row.id);
    }
  } else {
    if (org.subAgentOwnerUserId) {
      recipients.add(org.subAgentOwnerUserId);
    }
  }

  const expiryText = record.expiryDate.toLocaleDateString("en-GB");
  const staffName = record.user.name || record.user.email;
  const trainingName = record.training.name;
  const message = `Training Due: ${trainingName} for ${staffName} expires on ${expiryText}. Please renew.`;
  const emailSubject = `Training Renewal Required - ${trainingName}`;
  const emailBody = `<p>Your ${trainingName} certification is due to expire on ${expiryText}. Please complete renewal and upload your new certificate to the system.</p>`;

  const targetUsers = await db.user.findMany({
    where: { id: { in: Array.from(recipients) }, isActive: true },
    select: { id: true, email: true },
  });

  for (const target of targetUsers) {
    await NotificationService.createNotification({
      userId: target.id,
      type: "TRAINING_RENEWAL_REQUIRED",
      message,
      linkUrl:
        org.isSubAgentOrganisation
          ? "/agent/training"
          : "/dashboard/training",
      actorUserId: record.userId,
    }).catch(() => undefined);

    if (target.email) {
      await sendResendEmail({
        to: target.email,
        subject: emailSubject,
        html: emailBody,
      }).catch(() => undefined);
    }
  }

  await db.activityLog.create({
    data: {
      userId: record.userId,
      entityType: "training_record",
      entityId: record.id,
      action: triggerAction(trigger),
      details: `Sent training expiry notifications (${trigger}) for ${trainingName}`,
    },
  }).catch(() => undefined);

  return { sent: true, recipientCount: targetUsers.length };
}
