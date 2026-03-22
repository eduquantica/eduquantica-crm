import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkPermission } from "@/lib/permissions";
import { sendResendEmail } from "@/lib/resend";

interface RecipientData {
  email: string;
  studentName?: string;
  courseName?: string;
  universityName?: string;
  counsellorName?: string;
}

function renderTemplate(str: string, data: RecipientData) {
  return str
    .replace(/{{\s*student_name\s*}}/gi, data.studentName || "")
    .replace(/{{\s*university_name\s*}}/gi, data.universityName || "")
    .replace(/{{\s*course_name\s*}}/gi, data.courseName || "")
    .replace(/{{\s*counsellor_name\s*}}/gi, data.counsellorName || "");
}

async function gatherRecipients(params: {
  type?: string;
  nationality?: string | null;
  counsellorId?: string | null;
  studentIds?: string[];
  leadIds?: string[];
}) {
  const { type, nationality, counsellorId, studentIds, leadIds } = params;
  let recipients: RecipientData[] = [];

  switch (type) {
    case "all_students": {
      const students = await db.student.findMany({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        where: { email: { not: null as any } },
        include: {
          assignedCounsellor: true,
          applications: {
            where: { status: { not: "WITHDRAWN" } },
            include: { course: { include: { university: true } } },
            take: 1,
          },
        },
      });
      recipients = students.map((s) => ({
        email: s.email,
        studentName: `${s.firstName} ${s.lastName}`.trim(),
        counsellorName: s.assignedCounsellor?.name || "",
        universityName: s.applications[0]?.course.university.name || "",
        courseName: s.applications[0]?.course.name || "",
      }));
      break;
    }
    case "all_leads": {
      const leads = await db.lead.findMany({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        where: { email: { not: null as any } },
        include: { assignedCounsellor: true },
      });
      recipients = leads.map((l) => ({
        email: l.email as string,
        studentName: `${l.firstName} ${l.lastName}`.trim(),
        counsellorName: l.assignedCounsellor?.name || "",
      }));
      break;
    }
    case "active_applications": {
      const apps = await db.application.findMany({
        where: { status: { not: "WITHDRAWN" } },
        include: {
          student: { include: { assignedCounsellor: true } },
          course: { include: { university: true } },
        },
      });
      recipients = apps.map((a) => ({
        email: a.student.email,
        studentName: `${a.student.firstName} ${a.student.lastName}`.trim(),
        counsellorName: a.student.assignedCounsellor?.name || "",
        universityName: a.course.university.name,
        courseName: a.course.name,
      }));
      break;
    }
    case "by_nationality": {
      if (nationality) {
        const students = await db.student.findMany({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          where: { nationality, email: { not: null as any } },
          include: {
            assignedCounsellor: true,
            applications: {
                where: { status: { not: "WITHDRAWN" } },
              include: { course: { include: { university: true } } },
              take: 1,
            },
          },
        });
        recipients = students.map((s) => ({
          email: s.email,
          studentName: `${s.firstName} ${s.lastName}`.trim(),
          counsellorName: s.assignedCounsellor?.name || "",
          universityName: s.applications[0]?.course.university.name || "",
          courseName: s.applications[0]?.course.name || "",
        }));
      }
      break;
    }
    case "by_counsellor": {
      if (counsellorId) {
        const students = await db.student.findMany({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          where: { assignedCounsellorId: counsellorId, email: { not: null as any } },
          include: {
            assignedCounsellor: true,
            applications: {
              where: { status: { not: "WITHDRAWN" } },
              include: { course: { include: { university: true } } },
              take: 1,
            },
          },
        });
        recipients = students.map((s) => ({
          email: s.email,
          studentName: `${s.firstName} ${s.lastName}`.trim(),
          counsellorName: s.assignedCounsellor?.name || "",
          universityName: s.applications[0]?.course.university.name || "",
          courseName: s.applications[0]?.course.name || "",
        }));
      }
      break;
    }
    case "custom": {
      const byStudents = studentIds
        ? await db.student.findMany({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            where: { id: { in: studentIds }, email: { not: null as any } },
            include: {
              assignedCounsellor: true,
              applications: {
                where: { status: { not: "WITHDRAWN" } },
                include: { course: { include: { university: true } } },
                take: 1,
              },
            },
          })
        : [];
      const byLeads = leadIds
        ? await db.lead.findMany({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            where: { id: { in: leadIds }, email: { not: null as any } },
            include: { assignedCounsellor: true },
          })
        : [];
      recipients = [
        ...byStudents.map((s) => ({
          email: s.email,
          studentName: `${s.firstName} ${s.lastName}`.trim(),
          counsellorName: s.assignedCounsellor?.name || "",
          universityName: s.applications[0]?.course.university.name || "",
          courseName: s.applications[0]?.course.name || "",
        })),
        ...byLeads.map((l) => ({
          email: l.email as string,
          studentName: `${l.firstName} ${l.lastName}`.trim(),
          counsellorName: l.assignedCounsellor?.name || "",
        })),
      ];
      break;
    }
    default:
      recipients = [];
  }
  return recipients;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ count: 0 });
  }
  if (!checkPermission(session, "communications", "canView")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const type = url.searchParams.get("type") || undefined;
  const nationality = url.searchParams.get("nationality");
  const counsellorId = url.searchParams.get("counsellorId");
  const ids = url.searchParams.get("ids");
  const studentIds = ids ? ids.split(",").filter(Boolean) : undefined;
  const leadIds = url.searchParams.get("leadIds")
    ? url.searchParams.get("leadIds")!.split(",").filter(Boolean)
    : undefined;
  const preview = url.searchParams.get("preview") === "true";

  const recipients = await gatherRecipients({
    type,
    nationality,
    counsellorId,
    studentIds,
    leadIds,
  });

  const count = recipients.length;
  let sample = null;
  if (preview && count > 0) {
    sample = recipients[0];
  }

  return NextResponse.json({ count, sample });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!checkPermission(session, "communications", "canCreate")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const {
    type,
    nationality,
    counsellorId,
    studentIds,
    leadIds,
    templateId,
    subject,
    body: htmlBody,
  } = body;

  const recipients = await gatherRecipients({
    type,
    nationality,
    counsellorId,
    studentIds,
    leadIds,
  });

  let subjectTemplate = subject;
  let bodyTemplate = htmlBody;
  let templateName = "Custom";
  if (templateId) {
    const tpl = await db.emailTemplate.findUnique({ where: { id: templateId } });
    if (tpl) {
      subjectTemplate = tpl.subject;
      bodyTemplate = tpl.body;
      templateName = tpl.name;
    }
  }

  // send emails sequentially
  for (const r of recipients) {
    const subj = renderTemplate(subjectTemplate || "", r);
    const html = renderTemplate(bodyTemplate || "", r);
    try {
      await sendResendEmail({ to: r.email, subject: subj, html });
    } catch (err) {
      console.error("Failed to send bulk email to", r.email, err);
    }
  }

  await db.activityLog.create({
    data: {
      userId: session.user.id,
      entityType: "bulk_email",
      entityId: templateId || "",
      action: "sent",
      details: `template=${templateName}, count=${recipients.length}`,
    },
  });

  return NextResponse.json({ success: true, count: recipients.length });
}
