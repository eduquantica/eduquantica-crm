import type { CourseLevel, Prisma, StudyMode } from "@prisma/client";
import { db } from "@/lib/db";
import { sendResendEmail } from "@/lib/resend";
import { NotificationService } from "@/lib/notifications";

/**
 * Courses on the public website (www.eduquantica.com/courses).
 * The website reads GET /api/public/courses (search + filters + facets) and
 * GET /api/public/courses/<id> (course page). Only active courses at active
 * universities with "Shown on website" appear. Its "Apply now" button opens
 * /register?course=<id>; middleware keeps the id in a cookie through sign-up or
 * log-in, then sends the student to /student/courses/<id>?interest=1, which calls
 * registerCourseInterest() below.
 */

export const COURSE_COOKIE = "eq_course";

const LEVELS: CourseLevel[] = ["FOUNDATION", "CERTIFICATE", "DIPLOMA", "BACHELORS", "MASTERS", "PHD"];
const MODES: StudyMode[] = ["FULL_TIME", "PART_TIME", "ONLINE"];
const MAX_PAGE_SIZE = 48;

const visibleCourse: Prisma.CourseWhereInput = {
  isActive: true,
  university: { isActive: true, showOnWebsite: true },
};

const visibleScholarship: Prisma.ScholarshipWhereInput = { isActive: true, showOnWebsite: true };

export type CourseSearchParams = {
  q?: string;
  country?: string;
  level?: string;
  subject?: string;
  university?: string;
  mode?: string;
  intake?: string;
  maxFee?: string;
  sort?: string;
  page?: string;
  pageSize?: string;
};

function buildWhere(p: CourseSearchParams): Prisma.CourseWhereInput {
  const and: Prisma.CourseWhereInput[] = [visibleCourse];
  const q = p.q?.trim().slice(0, 100);
  if (q) {
    for (const word of q.split(/\s+/).slice(0, 6)) {
      and.push({
        OR: [
          { name: { contains: word, mode: "insensitive" } },
          { fieldOfStudy: { contains: word, mode: "insensitive" } },
          { university: { name: { contains: word, mode: "insensitive" } } },
          { university: { city: { contains: word, mode: "insensitive" } } },
        ],
      });
    }
  }
  if (p.country) and.push({ university: { country: p.country } });
  if (p.level && LEVELS.includes(p.level as CourseLevel)) and.push({ level: p.level as CourseLevel });
  if (p.subject) and.push({ fieldOfStudy: p.subject });
  if (p.university) and.push({ universityId: p.university });
  if (p.mode && MODES.includes(p.mode as StudyMode)) and.push({ studyMode: p.mode as StudyMode });
  if (p.intake) and.push({ intakes: { has: p.intake } });
  const maxFee = Number(p.maxFee);
  if (p.maxFee && maxFee > 0) and.push({ tuitionFee: { lte: maxFee } });
  return { AND: and };
}

function orderBy(sort?: string): Prisma.CourseOrderByWithRelationInput[] {
  if (sort === "fee_asc") return [{ tuitionFee: { sort: "asc", nulls: "last" } }, { name: "asc" }];
  if (sort === "fee_desc") return [{ tuitionFee: { sort: "desc", nulls: "last" } }, { name: "asc" }];
  return [{ name: "asc" }];
}

const count = <T extends string | null>(values: T[]) => {
  const map = new Map<string, number>();
  for (const value of values) if (value) map.set(value, (map.get(value) ?? 0) + 1);
  return Array.from(map.entries()).map(([value, n]) => ({ value, count: n })).sort((a, b) => a.value.localeCompare(b.value));
};

/** Filter options with counts, over every course on the website (not just the current results). */
async function getFacets() {
  const rows = await db.course.findMany({
    where: visibleCourse,
    select: {
      level: true,
      fieldOfStudy: true,
      studyMode: true,
      intakes: true,
      university: { select: { id: true, name: true, country: true } },
    },
  });
  const universities = new Map<string, { id: string; name: string; country: string; count: number }>();
  for (const row of rows) {
    const u = universities.get(row.university.id) ?? { ...row.university, count: 0 };
    u.count += 1;
    universities.set(row.university.id, u);
  }
  return {
    total: rows.length,
    countries: count(rows.map((r) => r.university.country)),
    levels: count(rows.map((r) => r.level)),
    subjects: count(rows.map((r) => r.fieldOfStudy)),
    modes: count(rows.map((r) => r.studyMode)),
    intakes: count(rows.flatMap((r) => r.intakes)),
    universities: Array.from(universities.values()).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

const universityProfileSelect = {
  id: true,
  name: true,
  country: true,
  city: true,
  type: true,
  website: true,
  description: true,
  foundedYear: true,
  qsRanking: true,
  timesHigherRanking: true,
  postStudyWorkVisa: true,
} satisfies Prisma.UniversitySelect;

export async function searchPublicCourses(p: CourseSearchParams) {
  const pageSize = Math.min(Math.max(Number(p.pageSize) || 12, 1), MAX_PAGE_SIZE);
  const page = Math.max(Number(p.page) || 1, 1);
  const where = buildWhere(p);

  const [total, rows, facets, university] = await Promise.all([
    db.course.count({ where }),
    db.course.findMany({
      where,
      orderBy: orderBy(p.sort),
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        level: true,
        fieldOfStudy: true,
        duration: true,
        studyMode: true,
        tuitionFee: true,
        currency: true,
        intakes: true,
        university: { select: { id: true, name: true, country: true, city: true, type: true } },
        entryRequirement: { select: { englishReqIelts: true } },
        _count: { select: { scholarships: { where: visibleScholarship } } },
      },
    }),
    getFacets(),
    p.university
      ? db.university.findFirst({
          where: { id: p.university, isActive: true, showOnWebsite: true },
          select: {
            ...universityProfileSelect,
            _count: { select: { scholarships: { where: visibleScholarship } } },
          },
        })
      : null,
  ]);

  return {
    data: rows.map(({ entryRequirement, _count, ...row }) => ({
      ...row,
      englishReqIelts: entryRequirement?.englishReqIelts ?? null,
      scholarshipCount: _count.scholarships,
    })),
    total,
    page,
    pageSize,
    facets,
    university: university
      ? (({ _count, ...u }) => ({ ...u, scholarshipCount: _count.scholarships }))(university)
      : null,
  };
}

export async function getPublicCourse(id: string) {
  const course = await db.course.findFirst({
    where: { ...visibleCourse, id },
    select: {
      id: true,
      name: true,
      level: true,
      fieldOfStudy: true,
      duration: true,
      studyMode: true,
      tuitionFee: true,
      currency: true,
      applicationFee: true,
      description: true,
      curriculum: true,
      intakes: true,
      intakeDatesWithDeadlines: true,
      updatedAt: true,
      entryRequirement: {
        select: {
          overallDescription: true,
          englishReqIelts: true,
          englishReqPte: true,
          englishReqToefl: true,
          additionalNotes: true,
        },
      },
      university: { select: { ...universityProfileSelect, _count: { select: { courses: { where: { isActive: true } } } } } },
    },
  });
  if (!course) return null;

  const scholarships = await db.scholarship.findMany({
    where: { ...visibleScholarship, universityId: course.university.id, OR: [{ courseId: null }, { courseId: course.id }] },
    select: {
      id: true,
      name: true,
      amount: true,
      amountMax: true,
      currency: true,
      amountType: true,
      percentageOf: true,
      deadline: true,
    },
    orderBy: [{ deadline: { sort: "asc", nulls: "last" } }, { name: "asc" }],
  });

  const { university, entryRequirement, ...rest } = course;
  const { _count, ...profile } = university;
  return {
    ...rest,
    entryRequirement: entryRequirement ? publicEntryRequirement(entryRequirement) : null,
    university: { ...profile, courseCount: _count.courses },
    scholarships,
  };
}

/**
 * additionalNotes is sometimes the admissions builder's JSON (internal settings).
 * Only plain-text notes are public; from the JSON we keep just the IELTS band scores.
 */
function publicEntryRequirement(req: {
  overallDescription: string | null;
  englishReqIelts: number | null;
  englishReqPte: number | null;
  englishReqToefl: number | null;
  additionalNotes: string | null;
}) {
  let notes: string | null = req.additionalNotes?.trim() || null;
  let englishBands: Record<string, number> | null = null;
  if (notes?.startsWith("{")) {
    try {
      const bands = (JSON.parse(notes) as { builderMeta?: { englishBands?: Record<string, unknown> } }).builderMeta
        ?.englishBands;
      if (bands) {
        englishBands = Object.fromEntries(
          Object.entries(bands).filter((entry): entry is [string, number] => typeof entry[1] === "number"),
        );
      }
    } catch {
      // not JSON after all: keep as text
    }
    if (englishBands !== null || notes.startsWith("{\"")) notes = null;
  }
  return { ...req, additionalNotes: notes, englishBands };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/**
 * Save a course chosen on the website to the student's wishlist. The first time
 * only, email the student and notify them and their counsellor: check
 * eligibility, then apply for the course.
 */
export async function registerCourseInterest(studentId: string, courseId: string) {
  const course = await db.course.findFirst({
    where: { ...visibleCourse, id: courseId },
    select: { id: true, name: true, university: { select: { name: true } } },
  });
  if (!course) return { ok: false as const, error: "Course not found" };

  const existing = await db.studentWishlist.findUnique({
    where: { studentId_courseId: { studentId, courseId } },
    select: { id: true },
  });
  if (existing) return { ok: true as const, created: false, course };

  const student = await db.student.findUnique({
    where: { id: studentId },
    select: { id: true, userId: true, firstName: true, lastName: true, email: true, assignedCounsellorId: true },
  });
  if (!student) return { ok: false as const, error: "Student not found" };

  await db.studentWishlist.create({ data: { studentId, courseId } });

  const baseUrl = process.env.NEXTAUTH_URL || "https://eduquantica-crm.vercel.app";
  const courseUrl = `${baseUrl}/student/courses/${course.id}`;

  await sendResendEmail({
    to: student.email,
    subject: `${course.name} at ${course.university.name} – next steps`,
    html: `
      <p>Hi ${escapeHtml(student.firstName)},</p>
      <p>Thank you for your interest in <strong>${escapeHtml(course.name)}</strong> at <strong>${escapeHtml(course.university.name)}</strong>. We have saved it to your EduQuantica wishlist.</p>
      <p><strong>What to do next</strong></p>
      <ol>
        <li>Check your eligibility for the course in your profile.</li>
        <li>Apply for the course. Your counsellor will help you with documents and deadlines.</li>
        <li>Look for scholarships for this course in My Scholarships.</li>
      </ol>
      <p><a href="${courseUrl}">Check eligibility and apply</a></p>
      <p>EduQuantica</p>
    `,
  }).catch(() => undefined);

  await NotificationService.createNotification({
    userId: student.userId,
    type: "COURSE_INTEREST_ADDED",
    message: `${course.name} (${course.university.name}) was saved to your wishlist. Check your eligibility, then apply for the course.`,
    linkUrl: `/student/courses/${course.id}`,
  }).catch(() => undefined);

  if (student.assignedCounsellorId) {
    await NotificationService.createNotification({
      userId: student.assignedCounsellorId,
      type: "COURSE_INTEREST_ADDED",
      message: `${student.firstName} ${student.lastName} is interested in ${course.name} (${course.university.name}) from the website.`,
      linkUrl: `/dashboard/students/${student.id}`,
    }).catch(() => undefined);
  }

  return { ok: true as const, created: true, course };
}
