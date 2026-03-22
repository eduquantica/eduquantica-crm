import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildInterviewNotificationContext, notifyInterviewReminder } from "@/lib/interview-notifications";

const prismaWithInterview = db as typeof db & {
  preCasInterview: {
    findMany: (...args: unknown[]) => Promise<Array<{ applicationId: string; bookedDate: Date | null }>>;
  };
  visaInterview: {
    findMany: (...args: unknown[]) => Promise<Array<{ applicationId: string; bookedDate: Date | null }>>;
  };
};

function dayDiffFromToday(target: Date, now: Date) {
  const startNow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startTarget = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate()));
  return Math.round((startTarget.getTime() - startNow.getTime()) / (1000 * 60 * 60 * 24));
}

function startOfUtcDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function GET(req: Request) {
  const secret = req.headers.get("CRON_SECRET") || req.headers.get("x-cron-secret") || req.headers.get("cron_secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const todayStart = startOfUtcDay(now);

  const [preCasRows, visaRows] = await Promise.all([
    prismaWithInterview.preCasInterview.findMany({
      where: { isRequired: true, bookedDate: { not: null } },
      select: { applicationId: true, bookedDate: true },
    }),
    prismaWithInterview.visaInterview.findMany({
      where: { isRequired: true, bookedDate: { not: null } },
      select: { applicationId: true, bookedDate: true },
    }),
  ]);

  let remindersSent = 0;
  let scanned = 0;

  for (const row of preCasRows) {
    if (!row.bookedDate) continue;
    const diff = dayDiffFromToday(row.bookedDate, now);
    if (diff !== 7 && diff !== 1) continue;
    scanned += 1;

    const action = `pre_cas_interview_reminder_${diff}d`;
    const alreadySent = await db.activityLog.findFirst({
      where: {
        entityType: "application",
        entityId: row.applicationId,
        action,
        createdAt: { gte: todayStart },
      },
      select: { id: true },
    });
    if (alreadySent) continue;

    const ctx = await buildInterviewNotificationContext(row.applicationId);
    if (!ctx) continue;

    await notifyInterviewReminder("PRE_CAS", ctx, row.bookedDate, diff as 1 | 7);
    await db.activityLog.create({
      data: {
        userId: ctx.student.userId,
        entityType: "application",
        entityId: row.applicationId,
        action,
        details: `Pre-CAS reminder sent for ${row.bookedDate.toISOString()}`,
      },
    });
    remindersSent += 1;
  }

  for (const row of visaRows) {
    if (!row.bookedDate) continue;
    const diff = dayDiffFromToday(row.bookedDate, now);
    if (diff !== 7 && diff !== 1) continue;
    scanned += 1;

    const action = `visa_interview_reminder_${diff}d`;
    const alreadySent = await db.activityLog.findFirst({
      where: {
        entityType: "application",
        entityId: row.applicationId,
        action,
        createdAt: { gte: todayStart },
      },
      select: { id: true },
    });
    if (alreadySent) continue;

    const ctx = await buildInterviewNotificationContext(row.applicationId);
    if (!ctx) continue;

    await notifyInterviewReminder("VISA", ctx, row.bookedDate, diff as 1 | 7);
    await db.activityLog.create({
      data: {
        userId: ctx.student.userId,
        entityType: "application",
        entityId: row.applicationId,
        action,
        details: `Visa reminder sent for ${row.bookedDate.toISOString()}`,
      },
    });
    remindersSent += 1;
  }

  return NextResponse.json({
    data: {
      scanned,
      remindersSent,
    },
  });
}
