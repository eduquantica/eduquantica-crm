import { db } from "@/lib/db";
import { sendResendEmail } from "@/lib/resend";

export async function ensurePostEnrolmentService(applicationId: string) {
  const application = await db.application.findUnique({
    where: { id: applicationId },
    include: {
      student: true,
    },
  });

  if (!application) {
    throw new Error("Application not found");
  }

  const existing = await db.postEnrolmentService.findUnique({
    where: { applicationId },
  });

  if (existing) return existing;

  return db.postEnrolmentService.create({
    data: {
      applicationId,
      studentId: application.studentId,
    },
  });
}

export async function notifyLinkedSubAgent(
  studentId: string,
  message: string,
  actorUserId?: string,
) {
  const student = await db.student.findUnique({
    where: { id: studentId },
    include: {
      subAgent: {
        include: {
          user: true,
        },
      },
    },
  });

  const subAgentUser = student?.subAgent?.user;
  if (!student || !subAgentUser?.id || !subAgentUser.email) {
    return;
  }

  await db.activityLog.create({
    data: {
      userId: subAgentUser.id,
      entityType: "post_enrolment",
      entityId: studentId,
      action: "post_enrolment_updated",
      details: message,
    },
  });

  await sendResendEmail({
    to: subAgentUser.email,
    subject: `Post-enrolment update for ${student.firstName} ${student.lastName}`,
    html: `<p>Hello,</p><p>${message}</p><p>Please inform your student accordingly.</p>`,
  });

  if (actorUserId && actorUserId !== subAgentUser.id) {
    await db.activityLog.create({
      data: {
        userId: actorUserId,
        entityType: "post_enrolment",
        entityId: studentId,
        action: "sub_agent_notified",
        details: `Notified ${subAgentUser.email}`,
      },
    });
  }
}
