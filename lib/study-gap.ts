import { TaskPriority } from "@prisma/client";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/email";

export type StudyGapColour = "GREEN" | "YELLOW" | "RED";

export type StudyGapResult = {
  colour: StudyGapColour;
  gapYears: number;
  lastQualification: string;
};

const BELOW_BACHELOR_KEYWORDS = [
  "year 10",
  "year10",
  "year 12",
  "year12",
  "a level",
  "a-level",
  "alevel",
  "hsc",
  "ssc",
  "gcse",
  "o level",
  "o-level",
  "olevel",
  "waec",
  "neco",
  "ib",
  "diploma",
  "foundation",
  "certificate",
  "btec",
  "high school",
  "secondary",
];

const BACHELOR_MASTER_KEYWORDS = [
  "bachelor",
  "bachelors",
  "bsc",
  "ba",
  "undergraduate",
  "master",
  "masters",
  "msc",
  "ma",
  "mba",
  "postgraduate",
];

function normalizeText(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

function parseCompletionYear(value: string | null | undefined): number | null {
  if (!value) return null;
  const direct = Number(value);
  if (Number.isInteger(direct) && direct >= 1900 && direct <= 2100) return direct;

  const match = value.match(/(19|20)\d{2}/);
  if (!match) return null;
  const year = Number(match[0]);
  if (!Number.isInteger(year) || year < 1900 || year > 2100) return null;
  return year;
}

function isBachelorOrMasterQualification(name: string) {
  const text = normalizeText(name);
  if (!text) return false;

  if (BACHELOR_MASTER_KEYWORDS.some((keyword) => text.includes(keyword))) {
    return true;
  }

  if (BELOW_BACHELOR_KEYWORDS.some((keyword) => text.includes(keyword))) {
    return false;
  }

  return false;
}

async function createTaskIfMissing(opts: {
  title: string;
  studentId: string;
  userId: string;
  priority: TaskPriority;
  dueDate: Date;
  description: string;
}) {
  const existing = await db.task.findFirst({
    where: {
      title: opts.title,
      studentId: opts.studentId,
      status: { not: "COMPLETED" },
    },
    select: { id: true },
  });

  if (existing) return false;

  await db.task.create({
    data: {
      title: opts.title,
      studentId: opts.studentId,
      userId: opts.userId,
      priority: opts.priority,
      dueDate: opts.dueDate,
      description: opts.description,
    },
  });

  return true;
}

async function ensureOptionalChecklistItems(studentId: string, labels: string[]) {
  const latestChecklist = await db.documentChecklist.findFirst({
    where: { studentId },
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        select: {
          label: true,
        },
      },
    },
  });

  if (!latestChecklist) return 0;

  const existingLabels = new Set(latestChecklist.items.map((item) => item.label.trim().toLowerCase()));
  const toCreate = labels.filter((label) => !existingLabels.has(label.trim().toLowerCase()));

  if (toCreate.length === 0) return 0;

  await db.checklistItem.createMany({
    data: toCreate.map((label) => ({
      checklistId: latestChecklist.id,
      documentType: "OTHER",
      label,
      isRequired: false,
      status: "PENDING",
    })),
  });

  return toCreate.length;
}

async function notifyAdminsForRedGap(args: {
  studentId: string;
  studentName: string;
  gapYears: number;
}) {
  const admins = await db.user.findMany({
    where: { role: { name: "ADMIN" } },
    select: { id: true, email: true },
  });

  await Promise.all(
    admins.map(async (admin) => {
      const existingNotification = await db.notification.findFirst({
        where: {
          userId: admin.id,
          type: "STUDY_GAP_RED_ALERT",
          linkUrl: `/dashboard/students/${args.studentId}`,
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
        select: { id: true },
      });

      if (!existingNotification) {
        await db.notification.create({
          data: {
            userId: admin.id,
            type: "STUDY_GAP_RED_ALERT",
            message: `High risk study gap detected for ${args.studentName} (${args.gapYears} years).`,
            linkUrl: `/dashboard/students/${args.studentId}`,
          },
        });
      }

      if (admin.email) {
        await sendMail({
          to: admin.email,
          subject: "URGENT: High risk study gap detected",
          text: `A RED study gap indicator was detected for ${args.studentName} (${args.gapYears} years). Please review urgently.`,
          html: `<p>A <strong>RED</strong> study gap indicator was detected for <strong>${args.studentName}</strong> (${args.gapYears} years).</p><p>Please review urgently.</p>`,
        }).catch(() => undefined);
      }
    }),
  );
}

export class StudyGapCalculator {
  static async calculateGap(studentId: string): Promise<StudyGapResult> {
    const [student, latestQualification] = await Promise.all([
      db.student.findUnique({
        where: { id: studentId },
        select: {
          highestQualification: true,
          grades: true,
        },
      }),
      db.studentQualification.findFirst({
        where: {
          academicProfile: {
            studentId,
          },
        },
        orderBy: [{ yearCompleted: "desc" }, { createdAt: "desc" }],
        select: {
          qualName: true,
          qualType: true,
          yearCompleted: true,
        },
      }),
    ]);

    const lastQualification =
      latestQualification?.qualName ||
      latestQualification?.qualType?.replaceAll("_", " ") ||
      student?.highestQualification ||
      "Unknown";

    const completionYear =
      latestQualification?.yearCompleted ||
      parseCompletionYear(student?.grades || null) ||
      new Date().getUTCFullYear();

    const currentYear = new Date().getUTCFullYear();
    const gapYears = Math.max(0, currentYear - completionYear);

    const bachelorOrMaster = isBachelorOrMasterQualification(lastQualification);

    let colour: StudyGapColour = "GREEN";

    if (bachelorOrMaster) {
      colour = gapYears <= 5 ? "GREEN" : "YELLOW";
    } else {
      if (gapYears <= 2) colour = "GREEN";
      else if (gapYears <= 3) colour = "YELLOW";
      else colour = "RED";
    }

    return {
      colour,
      gapYears,
      lastQualification,
    };
  }

  static async recalculateAndHandleAlerts(studentId: string): Promise<StudyGapResult & { taskCreated: boolean }> {
    const [result, student] = await Promise.all([
      this.calculateGap(studentId),
      db.student.findUnique({
        where: { id: studentId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          assignedCounsellorId: true,
        },
      }),
    ]);

    if (!student) {
      return { ...result, taskCreated: false };
    }

    if (result.colour === "GREEN") {
      return { ...result, taskCreated: false };
    }

    const studentName = `${student.firstName} ${student.lastName}`.trim();

    if (result.colour === "YELLOW") {
      await ensureOptionalChecklistItems(student.id, ["Study Gap Explanation Letter"]);

      if (!student.assignedCounsellorId) {
        return { ...result, taskCreated: false };
      }

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 3);

      const title = `Review study gap for ${studentName} - ${result.gapYears} year gap`;
      const created = await createTaskIfMissing({
        title,
        studentId: student.id,
        userId: student.assignedCounsellorId,
        priority: "MEDIUM",
        dueDate,
        description: "Request a Study Gap Explanation Letter from the student.",
      });

      if (created) {
        await db.notification.create({
          data: {
            userId: student.assignedCounsellorId,
            type: "STUDY_GAP_ALERT",
            message: `Review study gap for ${studentName} (${result.gapYears} years).`,
            linkUrl: `/dashboard/students/${student.id}`,
          },
        });
      }

      return { ...result, taskCreated: created };
    }

    await ensureOptionalChecklistItems(student.id, ["Study Gap Explanation Letter", "Work Experience Letters"]);

    if (!student.assignedCounsellorId) {
      await notifyAdminsForRedGap({ studentId: student.id, studentName, gapYears: result.gapYears });
      return { ...result, taskCreated: false };
    }

    const dueDate = new Date();
    const title = `URGENT - High risk study gap for ${studentName} - ${result.gapYears} year gap`;
    const created = await createTaskIfMissing({
      title,
      studentId: student.id,
      userId: student.assignedCounsellorId,
      priority: "HIGH",
      dueDate,
      description: "Request both a Study Gap Explanation Letter and Work Experience Letters from the student.",
    });

    if (created) {
      await db.notification.create({
        data: {
          userId: student.assignedCounsellorId,
          type: "STUDY_GAP_ALERT",
          message: `URGENT: High risk study gap for ${studentName} (${result.gapYears} years).`,
          linkUrl: `/dashboard/students/${student.id}`,
        },
      });

      await notifyAdminsForRedGap({ studentId: student.id, studentName, gapYears: result.gapYears });
    }

    return { ...result, taskCreated: created };
  }
}
