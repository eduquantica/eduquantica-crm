import { db } from "@/lib/db";
import { NotificationService } from "@/lib/notifications";
import { sendResendEmail } from "@/lib/resend";

type InterviewTargetContext = {
  interviewId: string;
  studentId: string;
  studentUserId: string;
  studentEmail: string;
  studentName: string;
  universityName: string;
  score?: number | null;
  recommendation?: string | null;
  assignedById: string;
  assignedByName: string;
  subAgentId?: string | null;
  subAgentStaffId?: string | null;
};

export async function notifyMockInterviewAssigned(ctx: InterviewTargetContext) {
  await NotificationService.createNotification({
    userId: ctx.studentUserId,
    type: "MOCK_INTERVIEW_ASSIGNED",
    message: `Mock interview assigned for ${ctx.universityName}. Start when ready.`,
    linkUrl: "/student/mock-interview",
  }).catch(() => undefined);

  if (ctx.studentEmail) {
    await sendResendEmail({
      to: ctx.studentEmail,
      subject: "Mock Interview Assigned - Time to Prepare!",
      html: `<p>Your counsellor ${ctx.assignedByName} has assigned you a mock interview for ${ctx.universityName}.</p><p>This will help you prepare for your real interview.</p><p><a href=\"/student/mock-interview\">Click here to start when ready</a></p>`,
    }).catch(() => undefined);
  }
}

export async function notifyMockInterviewCompleted(ctx: InterviewTargetContext) {
  const scoreText = typeof ctx.score === "number" ? `${ctx.score.toFixed(2)}%` : "N/A";
  const resultText = ctx.recommendation || "NEEDS MORE PREPARATION";

  await NotificationService.createNotification({
    userId: ctx.studentUserId,
    type: "MOCK_INTERVIEW_COMPLETED",
    message: `Your mock interview report is ready. Score: ${scoreText} - ${resultText}`,
    linkUrl: `/student/mock-interview/${ctx.interviewId}/report`,
  }).catch(() => undefined);

  if (ctx.studentEmail) {
    await sendResendEmail({
      to: ctx.studentEmail,
      subject: "Your mock interview report is ready",
      html: `<p>Your mock interview report is ready.</p><p>Score: ${scoreText} - ${resultText}</p><p>Your report has been saved to your documents.</p>`,
    }).catch(() => undefined);
  }

  const [counsellorIds, managerIds, adminIds] = await Promise.all([
    db.student
      .findUnique({ where: { id: ctx.studentId }, select: { assignedCounsellorId: true } })
      .then((row) => (row?.assignedCounsellorId ? [row.assignedCounsellorId] : [])),
    db.user.findMany({ where: { role: { name: "MANAGER" }, isActive: true }, select: { id: true } }).then((rows) => rows.map((r) => r.id)),
    db.user.findMany({ where: { role: { name: "ADMIN" }, isActive: true }, select: { id: true } }).then((rows) => rows.map((r) => r.id)),
  ]);

  const counsellorUserIds = counsellorIds.filter(Boolean);

  await Promise.all(
    counsellorUserIds.map(async (userId) => {
      await NotificationService.createNotification({
        userId,
        type: "MOCK_INTERVIEW_COMPLETED_COUNSELLOR",
        message: `${ctx.studentName} completed mock interview. Score: ${scoreText} - ${resultText}`,
        linkUrl: `/dashboard/students/${ctx.studentId}`,
      }).catch(() => undefined);

      const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
      if (user?.email) {
        await sendResendEmail({
          to: user.email,
          subject: `${ctx.studentName} completed their mock interview`,
          html: `<p>${ctx.studentName} completed their mock interview.</p><p>Score: ${scoreText} - ${resultText}</p>`,
        }).catch(() => undefined);
      }

      if (typeof ctx.score === "number" && ctx.score < 60) {
        await NotificationService.createNotification({
          userId,
          type: "MOCK_INTERVIEW_URGENT_LOW_SCORE",
          message: `${ctx.studentName} scored ${ctx.score.toFixed(2)}%. Additional support is recommended.`,
          linkUrl: `/dashboard/students/${ctx.studentId}`,
        }).catch(() => undefined);

        if (user?.email) {
          await sendResendEmail({
            to: user.email,
            subject: `Urgent: ${ctx.studentName} scored below 60%`,
            html: `<p>${ctx.studentName} scored ${ctx.score.toFixed(2)}% on a mock interview.</p><p>Please review and follow up.</p>`,
          }).catch(() => undefined);
        }
      }
    }),
  );

  await Promise.all(
    managerIds.map((userId) =>
      NotificationService.createNotification({
        userId,
        type: "MOCK_INTERVIEW_COMPLETED_MANAGER",
        message: `${ctx.studentName} completed mock interview. Score: ${scoreText}`,
        linkUrl: `/dashboard/reports?tab=Mock+Interviews`,
      }).catch(() => undefined),
    ),
  );

  await Promise.all(
    adminIds.map((userId) =>
      NotificationService.createNotification({
        userId,
        type: "MOCK_INTERVIEW_COMPLETED_ADMIN",
        message: `${ctx.studentName} completed mock interview. Score: ${scoreText}`,
        linkUrl: `/dashboard/reports?tab=Mock+Interviews`,
      }).catch(() => undefined),
    ),
  );

  if (ctx.subAgentId) {
    const owner = await db.subAgent.findUnique({ where: { id: ctx.subAgentId }, select: { userId: true, user: { select: { email: true } } } });
    if (owner?.userId) {
      await NotificationService.createNotification({
        userId: owner.userId,
        type: "MOCK_INTERVIEW_COMPLETED_SUB_AGENT",
        message: `${ctx.studentName} completed mock interview. Score: ${scoreText}`,
        linkUrl: `/agent/students/${ctx.studentId}`,
      }).catch(() => undefined);

      if (owner.user?.email) {
        await sendResendEmail({
          to: owner.user.email,
          subject: `${ctx.studentName} completed mock interview`,
          html: `<p>${ctx.studentName} completed mock interview.</p><p>Score: ${scoreText}</p>`,
        }).catch(() => undefined);
      }
    }

    if (ctx.subAgentStaffId) {
      const staff = await db.subAgentStaff.findUnique({ where: { id: ctx.subAgentStaffId }, select: { userId: true } });
      if (staff?.userId) {
        await NotificationService.createNotification({
          userId: staff.userId,
          type: "MOCK_INTERVIEW_COMPLETED_BRANCH_COUNSELLOR",
          message: `${ctx.studentName} completed mock interview. Score: ${scoreText}`,
          linkUrl: `/agent/students/${ctx.studentId}`,
        }).catch(() => undefined);
      }
    }
  }
}
