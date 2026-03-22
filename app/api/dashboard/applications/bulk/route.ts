import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import templates from "@/lib/email-templates";
import sendResendEmail from "@/lib/resend";

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const ids: string[] = body.ids || [];
  const status: string | undefined = body.status;
  const emailTemplate: string | undefined = body.emailTemplate;

  if (ids.length === 0) {
    return NextResponse.json({ error: "No application IDs provided" }, { status: 400 });
  }

  // update statuses if requested
  if (status) {
    await db.application.updateMany({
      where: { id: { in: ids } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { status: status as any },
    });
  }

  // if email template requested, send an email for each application
  if (emailTemplate && templates[emailTemplate as keyof typeof templates]) {
    const tplFn = templates[emailTemplate as keyof typeof templates] as (
      studentName: string,
      courseName: string,
      universityName: string,
      counsellorName?: string
    ) => { subject: string; html: string };

    const apps = await db.application.findMany({
      where: { id: { in: ids } },
      include: {
        student: true,
        course: { include: { university: true } },
        counsellor: true,
      },
    });

    for (const app of apps) {
      try {
        const { subject, html } = tplFn(
          `${app.student.firstName} ${app.student.lastName}`,
          app.course.name,
          app.course.university.name,
          app.counsellor?.name || undefined
        );
        await sendResendEmail({ to: app.student.email, subject, html });
      } catch (err) {
        console.error("failed to send bulk email", err);
      }
    }
  }

  // log activity
  if (status) {
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: "application",
        entityId: ids[0] || "",
        action: `bulk_status_change`,
        details: `${session.user.name || session.user.email} updated ${ids.length} applications to ${status}`,
      },
    });
  }
  if (emailTemplate) {
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: "application",
        entityId: ids[0] || "",
        action: "bulk_email",
        details: `${session.user.name || session.user.email} sent "${emailTemplate}" email to ${ids.length} applications`,
      },
    });
  }

  return NextResponse.json({ success: true });
}