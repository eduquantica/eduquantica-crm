import { db } from "@/lib/db";
import { sendResendEmail } from "@/lib/resend";
import { NotificationService } from "@/lib/notifications";

/**
 * Scholarships on the public website (www.eduquantica.com/scholarships).
 * The website reads GET /api/public/scholarships; its "Apply now" button opens
 * /register?scholarship=<id>. Middleware keeps the id in a cookie through sign-up
 * or log-in, then sends the student to /student/scholarships?interest=<id>, which
 * calls registerScholarshipInterest() below.
 */

export const SCHOLARSHIP_COOKIE = "eq_scholarship";


/** Used when a scholarship has no studyLevels: take the level from its course, if it has one. */
const COURSE_LEVEL_TO_PROGRAMME: Record<string, string> = {
  FOUNDATION: "FOUNDATION",
  CERTIFICATE: "UNDERGRADUATE",
  DIPLOMA: "UNDERGRADUATE",
  BACHELORS: "UNDERGRADUATE",
  MASTERS: "MASTERS",
  PHD: "PHD",
};

export async function getPublicScholarships() {
  const rows = await db.scholarship.findMany({
    where: { isActive: true, showOnWebsite: true, university: { isActive: true } },
    select: {
      id: true,
      name: true,
      description: true,
      amount: true,
      amountMax: true,
      currency: true,
      amountType: true,
      percentageOf: true,
      isPartial: true,
      openDate: true,
      deadline: true,
      intakePeriod: true,
      eligibilityCriteria: true,
      nationalityRestrictions: true,
      minAcademicScore: true,
      minEnglishScore: true,
      isAutoRenewable: true,
      applicationProcess: true,
      externalUrl: true,
      studyLevels: true,
      fieldsOfStudy: true,
      updatedAt: true,
      university: { select: { id: true, name: true, country: true, city: true } },
      course: { select: { id: true, name: true, level: true, fieldOfStudy: true } },
    },
    orderBy: [{ deadline: { sort: "asc", nulls: "last" } }, { name: "asc" }],
  });

  return rows.map(({ course, studyLevels, fieldsOfStudy, nationalityRestrictions, ...row }) => {
    // Empty lists mean "all levels" / "all subjects"; "ALL" is the same as empty.
    const levels: string[] = studyLevels.filter((level) => level !== "ALL");
    if (!levels.length && course?.level && COURSE_LEVEL_TO_PROGRAMME[course.level]) {
      levels.push(COURSE_LEVEL_TO_PROGRAMME[course.level]);
    }
    const subjectList = fieldsOfStudy.length ? fieldsOfStudy : course?.fieldOfStudy ? [course.fieldOfStudy] : [];
    return {
      ...row,
      course: course ? { id: course.id, name: course.name } : null,
      studyLevels: levels,
      subjects: subjectList,
      nationalityRestrictions: (nationalityRestrictions ?? []).map((code) => code.trim().toUpperCase()).filter(Boolean),
    };
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function formatAmount(s: {
  amount: number;
  amountMax: number | null;
  currency: string;
  amountType: string;
  percentageOf: string | null;
}) {
  if (s.amountType === "PERCENTAGE") {
    const of = s.percentageOf === "LIVING" ? "living costs" : s.percentageOf === "TOTAL" ? "total costs" : "tuition fees";
    return s.amountMax ? `${s.amount}–${s.amountMax}% of ${of}` : `${s.amount}% of ${of}`;
  }
  const money = (value: number) =>
    new Intl.NumberFormat("en-GB", { style: "currency", currency: s.currency, maximumFractionDigits: 0 }).format(value);
  return s.amountMax ? `${money(s.amount)} to ${money(s.amountMax)}` : money(s.amount);
}

/**
 * Mark a scholarship as "interested" for a student. On the first time only, email
 * the student and notify them and their counsellor: check eligibility and apply
 * for the course first, then apply for the scholarship.
 */
export async function registerScholarshipInterest(studentId: string, scholarshipId: string) {
  const scholarship = await db.scholarship.findFirst({
    where: { id: scholarshipId, isActive: true },
    select: {
      id: true,
      name: true,
      amount: true,
      amountMax: true,
      currency: true,
      amountType: true,
      percentageOf: true,
      deadline: true,
      eligibilityCriteria: true,
      university: { select: { id: true, name: true } },
      course: { select: { id: true, name: true } },
    },
  });
  if (!scholarship) return { ok: false as const, error: "Scholarship not found" };

  const existing = await db.studentScholarshipApplication.findFirst({
    where: { studentId, scholarshipId },
    select: { id: true },
  });
  if (existing) return { ok: true as const, created: false, scholarship };

  const student = await db.student.findUnique({
    where: { id: studentId },
    select: { id: true, userId: true, firstName: true, lastName: true, email: true, assignedCounsellorId: true },
  });
  if (!student) return { ok: false as const, error: "Student not found" };

  await db.studentScholarshipApplication.create({
    data: { studentId, scholarshipId, status: "INTERESTED" },
  });

  const baseUrl = process.env.NEXTAUTH_URL || "https://eduquantica-crm.vercel.app";
  const courseUrl = scholarship.course
    ? `${baseUrl}/student/courses/${scholarship.course.id}`
    : `${baseUrl}/student/courses?q=${encodeURIComponent(scholarship.university.name)}`;
  const courseLabel = scholarship.course ? scholarship.course.name : `a course at ${scholarship.university.name}`;
  const deadline = scholarship.deadline
    ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(scholarship.deadline)
    : null;

  await sendResendEmail({
    to: student.email,
    subject: `Your scholarship: ${scholarship.name} – next steps`,
    html: `
      <p>Hi ${escapeHtml(student.firstName)},</p>
      <p>Thank you for your interest in the <strong>${escapeHtml(scholarship.name)}</strong> at <strong>${escapeHtml(scholarship.university.name)}</strong>. We have added it to your EduQuantica account.</p>
      <ul>
        <li><strong>University:</strong> ${escapeHtml(scholarship.university.name)}</li>
        <li><strong>Course:</strong> ${escapeHtml(scholarship.course?.name ?? "Any eligible course")}</li>
        <li><strong>Award:</strong> ${escapeHtml(formatAmount(scholarship))}</li>
        ${deadline ? `<li><strong>Scholarship deadline:</strong> ${deadline}</li>` : ""}
      </ul>
      <p><strong>Eligibility:</strong> ${escapeHtml(scholarship.eligibilityCriteria)}</p>
      <p><strong>What to do next</strong></p>
      <ol>
        <li>Check that you meet the eligibility requirements for the course and the scholarship.</li>
        <li>Apply for ${escapeHtml(courseLabel)} first. You need a course application before you can apply for the scholarship.</li>
        <li>Then apply for the scholarship from <a href="${baseUrl}/student/scholarships">My Scholarships</a>. Your counsellor will help you.</li>
      </ol>
      <p><a href="${courseUrl}">Check eligibility and apply for the course</a></p>
      <p>EduQuantica</p>
    `,
  }).catch(() => undefined);

  await NotificationService.createNotification({
    userId: student.userId,
    type: "SCHOLARSHIP_INTEREST_ADDED",
    message: `${scholarship.name} (${scholarship.university.name}) was added to your scholarships. Check your eligibility and apply for the course first, then apply for the scholarship.`,
    linkUrl: scholarship.course ? `/student/courses/${scholarship.course.id}` : "/student/scholarships",
  }).catch(() => undefined);

  if (student.assignedCounsellorId) {
    await NotificationService.createNotification({
      userId: student.assignedCounsellorId,
      type: "SCHOLARSHIP_STATUS_UPDATED",
      message: `${student.firstName} ${student.lastName} is interested in ${scholarship.name} (${scholarship.university.name}) from the website.`,
      linkUrl: `/dashboard/students/${student.id}`,
    }).catch(() => undefined);
  }

  return { ok: true as const, created: true, scholarship };
}
