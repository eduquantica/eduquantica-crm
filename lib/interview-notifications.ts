import { NotificationService } from "@/lib/notifications";
import { sendMail } from "@/lib/email";
import { db } from "@/lib/db";

type PreCasStage = "BEFORE_OFFER" | "AFTER_CONDITIONAL_OFFER" | "DURING_CAS_ISSUE";
type InterviewOutcome = "PASSED" | "FAILED" | "RESCHEDULED" | "CANCELLED_BY_UNIVERSITY" | "NO_SHOW";

type InterviewType = "PRE_CAS" | "VISA";

type InterviewNotificationContext = {
  applicationId: string;
  student: {
    userId: string;
    fullName: string;
    email: string;
    assignedCounsellorId: string | null;
    subAgent: { userId: string; agencyName: string; staffManagers: Array<{ userId: string }> } | null;
  };
  universityName: string;
  courseName: string;
};

function interviewLabel(type: InterviewType) {
  return type === "PRE_CAS" ? "Pre-CAS interview" : "Visa interview";
}

function formatDate(value: Date | null | undefined) {
  if (!value) return "date not set";
  return new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function preCasStageLabel(stage: PreCasStage | null | undefined) {
  if (!stage) return "Stage not set";
  if (stage === "BEFORE_OFFER") return "Before Offer Letter";
  if (stage === "AFTER_CONDITIONAL_OFFER") return "After Conditional Offer";
  return "During CAS Issue";
}

function outcomeMessage(type: InterviewType, studentName: string, outcome: InterviewOutcome, rescheduledDate?: Date | null) {
  const label = interviewLabel(type);
  if (outcome === "PASSED") return `${studentName} passed their ${label}`;
  if (outcome === "FAILED") return `${studentName} failed their ${label}. Please contact the student immediately.`;
  if (outcome === "RESCHEDULED") return `${label} for ${studentName} has been rescheduled to ${formatDate(rescheduledDate)}`;
  if (outcome === "CANCELLED_BY_UNIVERSITY") return `${label} for ${studentName} was cancelled by the university.`;
  return `${studentName} did not attend their ${label}.`;
}

async function getAdminAndManagerIds() {
  const rows = await db.user.findMany({
    where: { isActive: true, role: { name: { in: ["ADMIN", "MANAGER"] } } },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

function uniqueUserIds(ids: Array<string | null | undefined>) {
  return Array.from(new Set(ids.filter((v): v is string => !!v)));
}

async function notifyUsers(userIds: string[], type: string, message: string, linkUrl: string) {
  await Promise.all(
    userIds.map((userId) =>
      NotificationService.createNotification({
        userId,
        type,
        message,
        linkUrl,
      }),
    ),
  );
}

async function getCoreRecipients(ctx: InterviewNotificationContext) {
  const adminsManagers = await getAdminAndManagerIds();
  return uniqueUserIds([
    ...adminsManagers,
    ctx.student.assignedCounsellorId,
    ctx.student.subAgent?.userId,
    ...((ctx.student.subAgent?.staffManagers || []).map((row) => row.userId)),
  ]);
}

export async function buildInterviewNotificationContext(applicationId: string): Promise<InterviewNotificationContext | null> {
  const app = await db.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      course: { select: { name: true } },
      university: { select: { name: true } },
      student: {
        select: {
          userId: true,
          email: true,
          firstName: true,
          lastName: true,
          assignedCounsellorId: true,
          subAgent: {
            select: {
              userId: true,
              agencyName: true,
              staffMembers: {
                where: { isActive: true, role: { contains: "MANAGER" } },
                select: { userId: true },
              },
            },
          },
        },
      },
    },
  });

  if (!app) return null;

  return {
    applicationId: app.id,
    student: {
      userId: app.student.userId,
      fullName: `${app.student.firstName} ${app.student.lastName}`.trim(),
      email: app.student.email,
      assignedCounsellorId: app.student.assignedCounsellorId,
      subAgent: app.student.subAgent
        ? {
            userId: app.student.subAgent.userId,
            agencyName: app.student.subAgent.agencyName,
            staffManagers: app.student.subAgent.staffMembers,
          }
        : null,
    },
    universityName: app.university.name,
    courseName: app.course.name,
  };
}

export async function notifyInterviewRequired(type: InterviewType, ctx: InterviewNotificationContext) {
  const recipients = await getCoreRecipients(ctx);
  const message = `${type === "PRE_CAS" ? "Pre-CAS" : "Visa"} interview required for ${ctx.student.fullName} applying to ${ctx.universityName} - ${ctx.courseName}`;
  await notifyUsers(recipients, "INTERVIEW_REQUIRED", message, `/dashboard/applications/${ctx.applicationId}`);
}

export async function notifyInterviewBooked(type: InterviewType, ctx: InterviewNotificationContext, bookedDate: Date | null, stage?: PreCasStage | null) {
  const recipients = await getCoreRecipients(ctx);
  const stageSuffix = type === "PRE_CAS" ? ` - ${preCasStageLabel(stage)}` : "";
  const message = `${type === "PRE_CAS" ? "Pre-CAS" : "Visa"} interview scheduled for ${ctx.student.fullName} on ${formatDate(bookedDate)}${stageSuffix}`;
  await notifyUsers(recipients, "INTERVIEW_BOOKED", message, `/dashboard/applications/${ctx.applicationId}`);

  if (type === "PRE_CAS") {
    await sendMail({
      to: ctx.student.email,
      subject: "Your Pre-CAS Interview Has Been Scheduled",
      text: `Your university interview has been booked for ${formatDate(bookedDate)}. Please prepare and contact your counsellor if you need help.`,
      html: `<p>Your university interview has been booked for <strong>${formatDate(bookedDate)}</strong>.</p><p>Please prepare and contact your counsellor if you need help.</p>`,
    });
  }
}

export async function notifyInterviewReminder(type: InterviewType, ctx: InterviewNotificationContext, bookedDate: Date, daysBefore: 7 | 1) {
  const coreRecipients = await getCoreRecipients(ctx);
  const recipients = uniqueUserIds([ctx.student.userId, ...coreRecipients]);
  const when = daysBefore === 1 ? "TOMORROW" : `in ${daysBefore} days`;
  const message = `Reminder: ${type === "PRE_CAS" ? "Pre-CAS" : "Visa"} interview for ${ctx.student.fullName} is ${when} on ${formatDate(bookedDate)}`;
  await notifyUsers(recipients, "INTERVIEW_REMINDER", message, `/dashboard/applications/${ctx.applicationId}`);
}

export async function notifyInterviewOutcome(
  type: InterviewType,
  ctx: InterviewNotificationContext,
  outcome: InterviewOutcome,
  rescheduledDate?: Date | null,
) {
  const coreRecipients = await getCoreRecipients(ctx);
  const recipients = uniqueUserIds([
    ...coreRecipients,
    ctx.student.assignedCounsellorId,
    ctx.student.subAgent?.userId,
  ]);
  const message = outcomeMessage(type, ctx.student.fullName, outcome, rescheduledDate);
  await notifyUsers(recipients, "INTERVIEW_OUTCOME", message, `/dashboard/applications/${ctx.applicationId}`);
}
