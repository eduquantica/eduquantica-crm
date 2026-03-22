import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendResendEmail } from "@/lib/resend";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

const DAY_MS = 24 * 60 * 60 * 1000;

function dateOnlyUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

export async function GET(req: Request) {
  const secret =
    req.headers.get("CRON_SECRET") ||
    req.headers.get("cron_secret") ||
    req.headers.get("x-cron-secret");
  const isCronAuthorized = !!secret && secret === process.env.CRON_SECRET;

  if (!isCronAuthorized) {
    const session = await getServerSession(authOptions);
    const role = session?.user?.roleName;
    const isManualAuthorized = !!session?.user?.email && (role === "ADMIN" || role === "MANAGER");

    if (!isManualAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const now = new Date();
    const inSevenDays = new Date(now.getTime() + 7 * DAY_MS);

    const visas = await db.visaApplication.findMany({
      where: {
        appointmentDate: {
          gte: now,
          lte: inSevenDays,
        },
      },
      include: {
        student: true,
        application: {
          include: {
            counsellor: true,
          },
        },
      },
      orderBy: {
        appointmentDate: "asc",
      },
    });

    const fallbackUser =
      (await db.user.findFirst({ where: { role: { name: "ADMIN" } }, select: { id: true } })) ||
      (await db.user.findFirst({ select: { id: true } }));

    let remindersSent = 0;
    let tasksCreated = 0;
    let duplicatesSkipped = 0;

    for (const visa of visas) {
      if (!visa.appointmentDate) continue;

      const daysUntil = Math.max(0, Math.ceil((visa.appointmentDate.getTime() - now.getTime()) / DAY_MS));
      const reminderAction = `visa_appointment_reminder_${daysUntil}d`;
      const reminderDetails = `appointment:${dateOnlyUtc(visa.appointmentDate)}`;

      const alreadySent = await db.activityLog.findFirst({
        where: {
          entityType: "visa",
          entityId: visa.id,
          action: reminderAction,
          details: reminderDetails,
        },
        select: { id: true },
      });

      if (alreadySent) {
        duplicatesSkipped += 1;
        continue;
      }

      const studentName = `${visa.student.firstName} ${visa.student.lastName}`;
      const apptText = formatDateTime(visa.appointmentDate);
      const locationText = visa.appointmentLocation || "Location not set";
      const counsellor = visa.application.counsellor;

      if (visa.student.email) {
        await sendResendEmail({
          to: visa.student.email,
          subject: `Your visa appointment is in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`,
          html: `<p>Hi ${studentName},</p><p>Your visa appointment is in <strong>${daysUntil} day${daysUntil === 1 ? "" : "s"}</strong>.</p><p><strong>Date:</strong> ${apptText} (UTC)<br/><strong>Location:</strong> ${locationText}</p><p>Please ensure your documents are ready.</p>`,
        });
      }

      if (counsellor?.email) {
        await sendResendEmail({
          to: counsellor.email,
          subject: `Reminder: ${studentName} has a visa appointment in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`,
          html: `<p>Hi ${counsellor.name || "Counsellor"},</p><p><strong>${studentName}</strong> has a visa appointment in <strong>${daysUntil} day${daysUntil === 1 ? "" : "s"}</strong>.</p><p><strong>Date:</strong> ${apptText} (UTC)<br/><strong>Location:</strong> ${locationText}</p>`,
        });

        const taskTitle = `Prepare ${studentName} for visa appointment on ${visa.appointmentDate.toISOString().slice(0, 10)}`;
        const dueDate = new Date(visa.appointmentDate.getTime() - 2 * DAY_MS);

        const existingTask = await db.task.findFirst({
          where: {
            userId: counsellor.id,
            studentId: visa.studentId,
            title: taskTitle,
          },
          select: { id: true },
        });

        if (!existingTask) {
          await db.task.create({
            data: {
              userId: counsellor.id,
              studentId: visa.studentId,
              title: taskTitle,
              description: `Visa appointment at ${locationText} on ${apptText} (UTC).`,
              dueDate,
              priority: "MEDIUM",
              status: "PENDING",
            },
          });
          tasksCreated += 1;
        }
      }

      if (counsellor?.id || fallbackUser?.id) {
        await db.activityLog.create({
          data: {
            userId: counsellor?.id || fallbackUser!.id,
            entityType: "visa",
            entityId: visa.id,
            action: reminderAction,
            details: reminderDetails,
          },
        });
      }

      remindersSent += 1;
    }

    return NextResponse.json({
      data: {
        scanned: visas.length,
        remindersSent,
        tasksCreated,
        duplicatesSkipped,
      },
    });
  } catch (error) {
    console.error("visa-reminders cron failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
