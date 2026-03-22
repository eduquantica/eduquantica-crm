import Fuse from "fuse.js";
import { MatchStatus, SubjectReqType, TaskPriority, TaskStatus, type QualType } from "@prisma/client";
import { db } from "@/lib/db";
import { type GradeQualType } from "@/lib/grade-normalisation";
import { checkEligibility as checkEligibilityShared } from "@/lib/eligibility/checkEligibility";
import { statusScore, toMatchStatus } from "@/lib/eligibility/presentation";

type SubjectMatchMethod = "exact" | "alias" | "fuzzy" | "category" | "none";

type EvaluatedRequirement = {
  requirementId: string;
  requiredSubject: string;
  requirementType: SubjectReqType;
  minimumUniversal: number | null;
  matchedSubject: string | null;
  studentUniversal: number | null;
  met: boolean;
  method: SubjectMatchMethod;
  alternativeGroupId: string | null;
  isAlternativeGroup: boolean;
};

export class EligibilityMatcher {
  private static countryQualificationToGradeQualType(value?: string | null): GradeQualType | null {
    if (!value) return null;

    if (value === "UK_ALEVEL" || value === "UK_GCSE" || value === "UK_BTEC" || value === "SRI_LANKA_AL") return "GCSE_ALEVEL";
    if (value === "IB_DIPLOMA") return "IB";
    if (value === "BANGLADESH_SSC" || value === "BANGLADESH_HSC") return "SSC_HSC";
    if (value === "INDIA_CLASS10" || value === "INDIA_CLASS12") return "PERCENTAGE";
    if (value === "PAKISTAN_MATRIC" || value === "PAKISTAN_FSCINTERMEDIATE") return "O_LEVEL";
    if (value === "NIGERIA_WAEC") return "WAEC";
    if (value === "NIGERIA_JAMB") return "PERCENTAGE";
    if (value === "US_HIGHSCHOOL" || value === "US_AP") return "GPA_4";
    if (value === "CANADA_HIGHSCHOOL") return "PERCENTAGE";
    if (value === "AUSTRALIA_YEAR12") return "PERCENTAGE";
    if (value === "MALAYSIA_STPM") return "PERCENTAGE";
    if (value === "NEPAL_SLC") return "PERCENTAGE";

    return null;
  }

  private static normalize(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, " ");
  }

  private static parseNumeric(value: string | null | undefined): number | null {
    if (!value) return null;
    const parsed = Number(String(value).replace(/[^\d.\-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  private static hasAcceptedQualification(accepted: QualType[], studentQualTypes: QualType[]): boolean {
    if (!accepted.length) return true;
    return studentQualTypes.some((qualType) => accepted.includes(qualType));
  }

  private static evaluateEnglishRequirement(args: {
    testType: string | null;
    testScore: string | null;
    ielts: number | null;
    pte: number | null;
    toefl: number | null;
  }): boolean | null {
    const { testType, testScore, ielts, pte, toefl } = args;
    if (ielts == null && pte == null && toefl == null) return null;

    const score = this.parseNumeric(testScore);
    if (score == null || !testType) return false;

    const normalizedType = this.normalize(testType);
    if (normalizedType.includes("ielts") && ielts != null) return score >= ielts;
    if (normalizedType.includes("pte") && pte != null) return score >= pte;
    if (normalizedType.includes("toefl") && toefl != null) return score >= toefl;
    return false;
  }

  private static async createPartialMatchTask(args: {
    studentId: string;
    assignedCounsellorId: string | null;
    studentName: string;
    courseId: string;
    courseName: string;
    missingSubjects: string[];
    weakSubjects: string[];
    englishMet: boolean | null;
  }) {
    const {
      studentId,
      assignedCounsellorId,
      studentName,
      courseId,
      courseName,
      missingSubjects,
      weakSubjects,
      englishMet,
    } = args;

    if (!assignedCounsellorId) return;

    const title = `Review partial eligibility: ${studentName} - ${courseName}`;
    const existing = await db.task.findFirst({
      where: {
        userId: assignedCounsellorId,
        studentId,
        title,
        status: {
          in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS],
        },
      },
      select: { id: true },
    });

    if (existing) return;

    const notes = [
      missingSubjects.length ? `Missing subjects: ${missingSubjects.join(", ")}` : null,
      weakSubjects.length ? `Weak subjects: ${weakSubjects.join(", ")}` : null,
      englishMet === false ? "English requirement not met" : null,
      `Course ID: ${courseId}`,
    ].filter(Boolean);

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);

    await db.task.create({
      data: {
        userId: assignedCounsellorId,
        studentId,
        title,
        description: notes.join(" | "),
        dueDate,
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.PENDING,
      },
    });
  }

  private static evaluateRequirement(args: {
    requirement: {
      id: string;
      subjectName: string;
      subjectAliases: string[];
      subjectCategory: string | null;
      minimumUniversal: number | null;
      requirementType: SubjectReqType;
      alternativeGroupId: string | null;
      isAlternativeGroup: boolean;
    };
    studentSubjects: Array<{
      subjectName: string;
      subjectCategory: string;
      universalScore: number | null;
      normalizedName: string;
    }>;
  }): EvaluatedRequirement {
    const { requirement, studentSubjects } = args;
    const allVariants = Array.from(
      new Set([requirement.subjectName, ...requirement.subjectAliases].map((item) => this.normalize(item))),
    );
    const [primaryVariant, ...aliasVariants] = allVariants;

    const pickBestByScore = (
      items: Array<{ subjectName: string; subjectCategory: string; universalScore: number | null; normalizedName: string }>,
    ) => items.sort((a, b) => (b.universalScore ?? -1) - (a.universalScore ?? -1))[0] ?? null;

    let matched = pickBestByScore(
      studentSubjects.filter((subject) => subject.normalizedName === primaryVariant),
    );
    let method: SubjectMatchMethod = matched ? "exact" : "none";

    if (!matched && aliasVariants.length) {
      matched = pickBestByScore(
        studentSubjects.filter((subject) => aliasVariants.includes(subject.normalizedName)),
      );
      if (matched) method = "alias";
    }

    if (!matched && studentSubjects.length) {
      const fuse = new Fuse(studentSubjects, {
        keys: ["subjectName"],
        includeScore: true,
        threshold: 0.4,
      });

      let best: { item: (typeof studentSubjects)[number]; score: number } | null = null;
      for (const variant of allVariants) {
        const candidate = fuse.search(variant, { limit: 1 })[0];
        if (!candidate || candidate.score == null) continue;
        const confidence = 1 - candidate.score;
        if (confidence < 0.6) continue;

        if (!best || candidate.score < best.score) {
          best = { item: candidate.item, score: candidate.score };
        }
      }

      if (best) {
        matched = best.item;
        method = "fuzzy";
      }
    }

    if (!matched && requirement.subjectCategory) {
      matched = pickBestByScore(
        studentSubjects.filter((subject) => subject.subjectCategory === requirement.subjectCategory),
      );
      if (matched) method = "category";
    }

    const minimum = requirement.minimumUniversal;
    const met = !!matched && (minimum == null || ((matched.universalScore ?? -1) >= minimum));

    return {
      requirementId: requirement.id,
      requiredSubject: requirement.subjectName,
      requirementType: requirement.requirementType,
      minimumUniversal: minimum,
      matchedSubject: matched?.subjectName ?? null,
      studentUniversal: matched?.universalScore ?? null,
      met,
      method,
      alternativeGroupId: requirement.alternativeGroupId,
      isAlternativeGroup: requirement.isAlternativeGroup,
    };
  }

  static async checkEligibility(studentId: string, courseId: string) {
    const [student, course, sharedResult] = await Promise.all([
      db.student.findUnique({
        where: { id: studentId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          assignedCounsellorId: true,
        },
      }),
      db.course.findUnique({
        where: { id: courseId },
        select: {
          id: true,
          name: true,
        },
      }),
      checkEligibilityShared(studentId, courseId),
    ]);

    if (!student) throw new Error("Student not found");
    if (!course) throw new Error("Course not found");

    const matchStatus = toMatchStatus(sharedResult);
    const matchScore = statusScore(sharedResult);
    const missingSubjects = sharedResult.missingRequirements;
    const weakSubjects: string[] = [];

    const counsellorFlagNote = [
      sharedResult.overridden ? "Eligibility manually approved" : null,
      sharedResult.message && sharedResult.message !== "No specific requirements set" ? sharedResult.message : null,
      missingSubjects.length ? `Missing: ${missingSubjects.join(", ")}` : null,
    ].filter(Boolean).join(" | ") || null;

    const subjectResults = [
      ...sharedResult.matchedRequirements.map((item) => ({
        requiredSubject: item,
        met: true,
      })),
      ...sharedResult.missingRequirements.map((item) => ({
        requiredSubject: item,
        met: false,
      })),
    ];

    const eligibilityResult = await db.courseEligibilityResult.upsert({
      where: {
        studentId_courseId: {
          studentId,
          courseId,
        },
      },
      create: {
        studentId,
        courseId,
        matchStatus,
        overallMet: sharedResult.eligible || sharedResult.partiallyEligible,
        matchScore,
        subjectResults,
        missingSubjects,
        weakSubjects,
        englishMet: null,
        counsellorFlagNote,
      },
      update: {
        matchStatus,
        overallMet: sharedResult.eligible || sharedResult.partiallyEligible,
        matchScore,
        subjectResults,
        missingSubjects,
        weakSubjects,
        englishMet: null,
        counsellorFlagNote,
        calculatedAt: new Date(),
      },
    });

    if (matchStatus === MatchStatus.PARTIAL_MATCH) {
      const studentName = `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim() || "Student";
      await this.createPartialMatchTask({
        studentId,
        assignedCounsellorId: student.assignedCounsellorId,
        studentName,
        courseId,
        courseName: course.name,
        missingSubjects,
        weakSubjects,
        englishMet: null,
      });
    }

    return eligibilityResult;
  }

  static async recalculateForStudentShortlisted(studentId: string) {
    const applications = await db.application.findMany({
      where: {
        studentId,
        status: {
          not: "WITHDRAWN",
        },
      },
      select: {
        courseId: true,
      },
      distinct: ["courseId"],
    });

    const results = await Promise.all(
      applications.map((application) => this.checkEligibility(studentId, application.courseId)),
    );

    return {
      totalCourses: applications.length,
      results,
    };
  }

  static async recalculateForCourse(courseId: string) {
    const students = await db.application.findMany({
      where: {
        courseId,
        status: {
          not: "WITHDRAWN",
        },
      },
      select: {
        studentId: true,
      },
      distinct: ["studentId"],
    });

    const results = await Promise.all(
      students.map((student) => this.checkEligibility(student.studentId, courseId)),
    );

    return {
      totalStudents: students.length,
      results,
    };
  }
}
