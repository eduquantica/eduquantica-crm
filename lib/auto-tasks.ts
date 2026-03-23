import { db } from "./db";
import calculateProfileCompletion from "./profile-completion";
import { sendResendEmail } from "./resend";
import { TaskPriority } from "@prisma/client";
import { StudyGapCalculator } from "./study-gap";
import { NotificationService } from "./notifications";

// helper to avoid duplicate open tasks for same student/title
async function createTaskIfMissing(opts: {
  title: string;
  studentId?: string | null;
  userId: string; // assignee must be provided
  priority: TaskPriority;
  dueDate?: Date | null;
}) {
  const { title, studentId = null, userId, priority, dueDate = null } = opts;

  // look for existing non-completed task with exactly same title and same student
  const existing = await db.task.findFirst({
    where: {
      title,
      status: { not: "COMPLETED" },
      ...(studentId ? { studentId } : {}),
    },
  });

  if (existing) {
    return false;
  }

  await db.task.create({
    data: {
      title,
      studentId,
      userId,
      priority,
      dueDate,
    },
  });
  return true;
}

// ---------- trigger implementations ------------------------------------------------

/**
 * Trigger 1 - student profile incomplete after 3 days
 */
export async function triggerProfileIncomplete(): Promise<number> {
  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const students = await db.student.findMany({
    where: { createdAt: { lt: cutoff } },
    select: { id: true, firstName: true, lastName: true, assignedCounsellorId: true },
  });

  let count = 0;
  for (const s of students) {
    const pct = await calculateProfileCompletion(s.id);
    if (pct < 50) {
      const title = `Follow up with ${s.firstName} ${s.lastName} - profile incomplete`;
      const due = new Date();
      due.setDate(due.getDate() + 1);
      if (!s.assignedCounsellorId) continue;
    const created = await createTaskIfMissing({
        title,
        studentId: s.id,
        userId: s.assignedCounsellorId,
        priority: "MEDIUM",
        dueDate: due,
      });
      if (created) count++;
      if (created) {
        await NotificationService.createNotification({
          userId: s.assignedCounsellorId,
          type: "SYSTEM_PROFILE_INCOMPLETE_REMINDER",
          message: `${s.firstName} ${s.lastName} profile is still incomplete after 3 days.`,
          linkUrl: `/dashboard/students/${s.id}`,
        }).catch(() => undefined);
      }
    }
  }
  return count;
}

/**
 * Trigger 2 - application status unchanged for 7 days
 */
export async function triggerStaleApplication(): Promise<number> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  // NOTE: schema has no updatedAt column on Application, use createdAt as proxy
  const apps = await db.application.findMany({
    where: {
      createdAt: { lt: cutoff },
      status: { notIn: ["ENROLLED", "WITHDRAWN"] },
    },
    select: {
      id: true,
      status: true,
      student: {
        select: { id: true, firstName: true, lastName: true, assignedCounsellorId: true },
      },
      university: { select: { name: true } },
    },
  });

  let count = 0;
  for (const a of apps) {
    const student = a.student;
    if (!student) continue;
    const title = `Chase update for ${student.firstName} ${student.lastName} application to ${
      a.university.name
    }`;
    const due = new Date(); // today
    if (!student.assignedCounsellorId) continue;
    const created = await createTaskIfMissing({
      title,
      studentId: student.id,
      userId: student.assignedCounsellorId,
      priority: "HIGH",
      dueDate: due,
    });
    if (created) count++;
    if (created) {
      await NotificationService.createNotification({
        userId: student.assignedCounsellorId,
        type: "APPLICATION_STALE_REMINDER",
        message: `No update for ${student.firstName} ${student.lastName}'s application in 7 days.`,
        linkUrl: `/dashboard/students/${student.id}`,
      }).catch(() => undefined);
    }
  }
  return count;
}

/**
 * Trigger 3 - document flagged HIGH risk
 */
export async function triggerFlaggedDocuments(): Promise<number> {
  // find checklist items flagged high risk
  const items = await db.checklistItem.findMany({
    where: { fraudRiskLevel: "HIGH" },
    select: {
      id: true,
      document: {
        select: {
          student: {
            select: { id: true, firstName: true, lastName: true, assignedCounsellorId: true },
          },
        },
      },
    },
  });

  let count = 0;
  for (const item of items) {
    const s = item.document?.student;
    if (!s) continue;
    const title = `URGENT - Review flagged document for ${s.firstName} ${s.lastName}`;
    const due = new Date();
    if (!s.assignedCounsellorId) continue;
    const created = await createTaskIfMissing({
      title,
      studentId: s.id,
      userId: s.assignedCounsellorId,
      priority: "HIGH",
      dueDate: due,
    });
    if (created) {
      count++;
      // email admins
      const admins = await db.user.findMany({
        where: { role: { name: "ADMIN" } },
        select: { email: true },
      });
      const promises = admins
        .filter((u) => u.email)
        .map((u) =>
          sendResendEmail({
            to: u.email!,
            subject: "URGENT - Document flagged HIGH risk",
            html: `A document for student ${s.firstName} ${
              s.lastName
            } was flagged HIGH risk. Please review urgently.`,
          }),
        );
      await Promise.all(promises);
    }
  }
  return count;
}

/**
 * Trigger 4 - sub-agent application pending >5 days
 */
export async function triggerSubAgentPending(): Promise<number> {
  const cutoff = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
  const subs = await db.subAgent.findMany({
    where: {
      approvalStatus: "PENDING",
      createdAt: { lt: cutoff },
    },
    select: { id: true, agencyName: true },
  });

  // pick an admin user to assign tasks to
  const adminUser = await db.user.findFirst({
    where: { role: { name: "ADMIN" } },
    select: { id: true },
  });

  let count = 0;
  for (const sa of subs) {
    const title = `Review pending sub-agent application: ${sa.agencyName}`;
    if (!adminUser?.id) continue;
    const created = await createTaskIfMissing({
      title,
      // no student for this trigger
      userId: adminUser.id,
      priority: "MEDIUM",
      dueDate: null,
    });
    if (created) count++;
  }
  return count;
}

export async function triggerStudyGapRecalculation(): Promise<number> {
  const students = await db.student.findMany({
    select: { id: true },
  });

  let created = 0;
  for (const student of students) {
    const result = await StudyGapCalculator.recalculateAndHandleAlerts(student.id);
    if (result.taskCreated) created += 1;
  }

  return created;
}

export async function triggerServiceReferralFollowUps(): Promise<number> {
  const now = new Date();
  const followUp7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const followUp30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const followUp60Days = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const candidates = await db.serviceReferral.findMany({
    where: {
      status: { in: ["SENT", "CLICKED", "ENQUIRED", "SHORTLISTED"] },
      placementConfirmed: false,
      OR: [
        {
          followUpCount: 0,
          createdAt: { lte: followUp7Days },
        },
        {
          followUpCount: 1,
          followUpSentAt: { lte: followUp30Days },
        },
        {
          followUpCount: 2,
          followUpSentAt: { lte: followUp60Days },
        },
      ],
    },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          userId: true,
          assignedCounsellorId: true,
        },
      },
      listing: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });

  if (candidates.length === 0) return 0;

  const adminUsers = await db.user.findMany({
    where: { role: { name: { in: ["ADMIN", "MANAGER"] } } },
    select: { id: true },
  });

  let count = 0;
  for (const referral of candidates) {
    const nextFollowUpCount = referral.followUpCount + 1;
    const studentName = `${referral.student.firstName} ${referral.student.lastName}`.trim();

    await db.serviceReferral.update({
      where: { id: referral.id },
      data: {
        followUpCount: { increment: 1 },
        followUpSentAt: now,
        adminNote: [
          referral.adminNote,
          `Automated follow-up #${nextFollowUpCount} sent on ${now.toISOString()}`,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    });

    const notifyUserIds = Array.from(
      new Set(
        [
          referral.student.userId,
          referral.student.assignedCounsellorId,
          ...adminUsers.map((user) => user.id),
        ].filter((value): value is string => Boolean(value)),
      ),
    );

    await Promise.all(
      notifyUserIds.map((userId) =>
        NotificationService.createNotification({
          userId,
          type: "SERVICE_REFERRAL_AUTO_FOLLOW_UP",
          message: `Referral ${referral.referralCode} (${studentName} - ${referral.listing.title}) auto follow-up #${nextFollowUpCount} sent.`,
          linkUrl: "/dashboard/student-services",
        }).catch(() => undefined),
      ),
    );

    count += 1;
  }

  return count;
}

// convenience runner
export async function runAllTriggers(): Promise<number> {
  const results = await Promise.all([
    triggerProfileIncomplete(),
    triggerStaleApplication(),
    triggerFlaggedDocuments(),
    triggerSubAgentPending(),
    triggerStudyGapRecalculation(),
    triggerServiceReferralFollowUps(),
  ]);
  return results.reduce((a, b) => a + b, 0);
}
