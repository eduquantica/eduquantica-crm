import { type QualType } from "@prisma/client";
import { db } from "@/lib/db";

export type EligibilityCheckResult = {
  eligible: boolean;
  partiallyEligible: boolean;
  overridden: boolean;
  overriddenBy?: string;
  overriddenAt?: Date;
  matchedRequirements: string[];
  missingRequirements: string[];
  message: string;
};

const LETTER_TO_PERCENTAGE: Record<string, number> = {
  "A*": 90,
  A: 85,
  "A-": 80,
  "B+": 75,
  B: 70,
  "B-": 65,
  "C+": 60,
  C: 55,
  "C-": 50,
};

const GPA_TO_PERCENTAGE: Array<{ gpa: number; percentage: number }> = [
  { gpa: 4.5, percentage: 90 },
  { gpa: 4.0, percentage: 80 },
  { gpa: 3.5, percentage: 70 },
  { gpa: 3.0, percentage: 60 },
  { gpa: 2.5, percentage: 50 },
];

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(String(value).replace(/[^\d.\-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function isEmptyRequirementValue(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function isMeaningfulRequirement(obj: Record<string, unknown>): boolean {
  return Object.values(obj).some((value) => !isEmptyRequirementValue(value));
}

function gpaToPercentage(gpa: number): number {
  if (gpa >= GPA_TO_PERCENTAGE[0].gpa) return GPA_TO_PERCENTAGE[0].percentage;
  if (gpa <= GPA_TO_PERCENTAGE[GPA_TO_PERCENTAGE.length - 1].gpa) {
    return Math.max(0, Math.round((gpa / GPA_TO_PERCENTAGE[GPA_TO_PERCENTAGE.length - 1].gpa) * GPA_TO_PERCENTAGE[GPA_TO_PERCENTAGE.length - 1].percentage));
  }

  for (let i = 0; i < GPA_TO_PERCENTAGE.length - 1; i += 1) {
    const high = GPA_TO_PERCENTAGE[i];
    const low = GPA_TO_PERCENTAGE[i + 1];
    if (gpa <= high.gpa && gpa >= low.gpa) {
      const ratio = (gpa - low.gpa) / (high.gpa - low.gpa);
      return Math.round(low.percentage + (high.percentage - low.percentage) * ratio);
    }
  }

  return 0;
}

function gradeToPercentage(grade: string | null | undefined): number | null {
  if (!grade) return null;

  const trimmed = grade.trim().toUpperCase();
  if (trimmed in LETTER_TO_PERCENTAGE) return LETTER_TO_PERCENTAGE[trimmed];

  const numeric = toNumber(trimmed);
  if (numeric == null) return null;

  if (numeric <= 5) {
    return gpaToPercentage(numeric);
  }

  if (numeric <= 100) return numeric;
  return null;
}

function minimumFromText(text: string | null | undefined): number | null {
  if (!text) return null;

  const gradeMatch = text.match(/minimum grade:\s*([^|]+)/i);
  if (gradeMatch?.[1]) {
    return gradeToPercentage(gradeMatch[1].trim());
  }

  return gradeToPercentage(text);
}

function englishScoreForTest(args: { englishTestType: string | null; englishTestScore: string | null; test: "ielts" | "pte" }): number | null {
  const { englishTestType, englishTestScore, test } = args;
  if (!englishTestType || !englishTestScore) return null;
  const type = normalize(englishTestType);
  if (!type.includes(test)) return null;
  return toNumber(englishTestScore);
}

function buildRequirementLabel(label: string, value: string): string {
  return `${label}: ${value}`;
}

function parseQualificationRowsFromNotes(notes: string | null | undefined): Array<{
  typeKey: string;
  subjectName: string;
  minimumUniversal: number | null;
  minimumGrade: string;
  notes: string;
}> {
  if (!notes) return [];

  try {
    const parsed = JSON.parse(notes) as {
      builderMeta?: {
        subjectRequirementsByType?: Record<string, Array<{
          subjectName?: string;
          minimumUniversal?: number | "";
          minimumGrade?: string;
          notes?: string;
        }>>;
      };
    };

    const byType = parsed.builderMeta?.subjectRequirementsByType;
    if (!byType) return [];

    return Object.entries(byType).flatMap(([typeKey, rows]) =>
      rows.map((row) => ({
        typeKey,
        subjectName: (row.subjectName || "").trim(),
        minimumUniversal: row.minimumUniversal === "" || row.minimumUniversal == null ? null : Number(row.minimumUniversal),
        minimumGrade: (row.minimumGrade || "").trim(),
        notes: (row.notes || "").trim(),
      })),
    );
  } catch {
    return [];
  }
}

export async function checkEligibility(studentId: string, courseId: string): Promise<EligibilityCheckResult> {
  const overrideDelegate = (db as unknown as {
    eligibilityOverride?: {
      findUnique: (args: {
        where: { studentId_courseId: { studentId: string; courseId: string } };
        select: { overriddenByName: true; createdAt: true };
      }) => Promise<{ overriddenByName: string; createdAt: Date } | null>;
    };
  }).eligibilityOverride;

  const override = overrideDelegate
    ? await overrideDelegate.findUnique({
      where: {
        studentId_courseId: {
          studentId,
          courseId,
        },
      },
      select: {
        overriddenByName: true,
        createdAt: true,
      },
    })
    : null;

  if (override) {
    return {
      eligible: true,
      partiallyEligible: false,
      overridden: true,
      overriddenBy: override.overriddenByName,
      overriddenAt: override.createdAt,
      matchedRequirements: ["Manual staff approval"],
      missingRequirements: [],
      message: "Eligibility manually approved",
    };
  }

  const [student, course] = await Promise.all([
    db.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        englishTestType: true,
        englishTestScore: true,
        academicProfile: {
          select: {
            qualifications: {
              select: {
                qualType: true,
                overallUniversal: true,
                overallGrade: true,
                subjects: {
                  select: {
                    subjectName: true,
                    universalScore: true,
                    rawGrade: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    db.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        entryRequirement: {
          select: {
            acceptedQualTypes: true,
            overallMinUniversal: true,
            overallDescription: true,
            englishReqIelts: true,
            englishReqPte: true,
            englishReqToefl: true,
            additionalNotes: true,
            subjectRequirements: {
              select: {
                subjectName: true,
                minimumUniversal: true,
                minimumDescription: true,
              },
            },
          },
        },
      },
    }),
  ]);

  if (!student) throw new Error("Student not found");
  if (!course) throw new Error("Course not found");

  const entryRequirement = course.entryRequirement;
  if (!entryRequirement) {
    return {
      eligible: true,
      partiallyEligible: false,
      overridden: false,
      matchedRequirements: [],
      missingRequirements: [],
      message: "No specific requirements set",
    };
  }

  const qualificationRows = student.academicProfile?.qualifications || [];
  const hasQualifications = qualificationRows.length > 0;

  const requirementChecks: Array<{
    key: string;
    matches: boolean;
  }> = [];

  const studentQualTypes = qualificationRows.map((row) => row.qualType);
  const allSubjectRows = qualificationRows.flatMap((qualification) => qualification.subjects);

  const qualificationOveralls = qualificationRows
    .map((qualification) => {
      if (qualification.overallUniversal != null) return qualification.overallUniversal;
      const byOverallGrade = gradeToPercentage(qualification.overallGrade);
      if (byOverallGrade != null) return byOverallGrade;
      const subjectScores = qualification.subjects
        .map((subject) => subject.universalScore ?? gradeToPercentage(subject.rawGrade))
        .filter((score): score is number => score != null);
      if (subjectScores.length === 0) return null;
      return subjectScores.reduce((sum, score) => sum + score, 0) / subjectScores.length;
    })
    .filter((value): value is number => value != null);

  const bestOverall = qualificationOveralls.length > 0 ? Math.max(...qualificationOveralls) : null;

  const entryRequirementJson = {
    acceptedQualTypes: entryRequirement.acceptedQualTypes,
    overallMinUniversal: entryRequirement.overallMinUniversal,
    overallDescription: entryRequirement.overallDescription,
    englishReqIelts: entryRequirement.englishReqIelts,
    englishReqPte: entryRequirement.englishReqPte,
    englishReqToefl: entryRequirement.englishReqToefl,
    subjectRequirements: entryRequirement.subjectRequirements,
  };

  if (!hasQualifications) {
    const hasAnyRequirementSet = isMeaningfulRequirement(entryRequirementJson)
      || parseQualificationRowsFromNotes(entryRequirement.additionalNotes).some((row) => isMeaningfulRequirement(row));

    if (!hasAnyRequirementSet) {
      return {
        eligible: true,
        partiallyEligible: false,
        overridden: false,
        matchedRequirements: [],
        missingRequirements: [],
        message: "No specific requirements set",
      };
    }

    return {
      eligible: false,
      partiallyEligible: false,
      overridden: false,
      matchedRequirements: [],
      missingRequirements: [],
      message: "Add qualifications to check eligibility",
    };
  }

  if (!isEmptyRequirementValue(entryRequirement.acceptedQualTypes)) {
    const accepted = entryRequirement.acceptedQualTypes as QualType[];
    const matched = accepted.some((qualType) => studentQualTypes.includes(qualType));
    requirementChecks.push({
      key: buildRequirementLabel("Accepted qualification", accepted.join(", ")),
      matches: matched,
    });
  }

  if (!isEmptyRequirementValue(entryRequirement.overallMinUniversal)) {
    const minimum = Number(entryRequirement.overallMinUniversal);
    requirementChecks.push({
      key: buildRequirementLabel("Minimum overall", `${minimum}%`),
      matches: bestOverall != null && bestOverall >= minimum,
    });
  }

  if (!isEmptyRequirementValue(entryRequirement.englishReqIelts)) {
    const required = Number(entryRequirement.englishReqIelts);
    const actual = englishScoreForTest({
      englishTestType: student.englishTestType,
      englishTestScore: student.englishTestScore,
      test: "ielts",
    });
    requirementChecks.push({
      key: buildRequirementLabel("IELTS", `${required}`),
      matches: actual != null && actual >= required,
    });
  }

  if (!isEmptyRequirementValue(entryRequirement.englishReqPte)) {
    const required = Number(entryRequirement.englishReqPte);
    const actual = englishScoreForTest({
      englishTestType: student.englishTestType,
      englishTestScore: student.englishTestScore,
      test: "pte",
    });
    requirementChecks.push({
      key: buildRequirementLabel("PTE", `${required}`),
      matches: actual != null && actual >= required,
    });
  }

  for (const subjectRequirement of entryRequirement.subjectRequirements) {
    const requirementShape = {
      subjectName: subjectRequirement.subjectName,
      minimumUniversal: subjectRequirement.minimumUniversal,
      minimumDescription: subjectRequirement.minimumDescription,
    };

    if (!isMeaningfulRequirement(requirementShape)) continue;
    if (isEmptyRequirementValue(subjectRequirement.subjectName)) continue;

    const minimumUniversal = subjectRequirement.minimumUniversal ?? minimumFromText(subjectRequirement.minimumDescription);
    const normalized = normalize(subjectRequirement.subjectName);
    const subject = allSubjectRows.find((row) => normalize(row.subjectName) === normalized) || null;
    const subjectScore = subject?.universalScore ?? gradeToPercentage(subject?.rawGrade);
    const matches = !!subject && (minimumUniversal == null || ((subjectScore ?? -1) >= minimumUniversal));

    requirementChecks.push({
      key: buildRequirementLabel(
        `Subject ${subjectRequirement.subjectName}`,
        minimumUniversal == null ? "required" : `>= ${Math.round(minimumUniversal)}%`,
      ),
      matches,
    });
  }

  const typedRows = parseQualificationRowsFromNotes(entryRequirement.additionalNotes);
  for (const row of typedRows) {
    if (!isMeaningfulRequirement(row)) continue;
    if (!row.subjectName) continue;

    const minimumUniversal = row.minimumUniversal ?? gradeToPercentage(row.minimumGrade);
    const normalized = normalize(row.subjectName);
    const subject = allSubjectRows.find((item) => normalize(item.subjectName) === normalized) || null;
    const subjectScore = subject?.universalScore ?? gradeToPercentage(subject?.rawGrade);
    const matches = !!subject && (minimumUniversal == null || ((subjectScore ?? -1) >= minimumUniversal));

    const typeLabel = row.typeKey.startsWith("CUSTOM:") ? row.typeKey.slice(7) : row.typeKey;
    requirementChecks.push({
      key: buildRequirementLabel(
        `${typeLabel} ${row.subjectName}`,
        minimumUniversal == null ? (row.minimumGrade || "required") : `>= ${Math.round(minimumUniversal)}%`,
      ),
      matches,
    });
  }

  if (requirementChecks.length === 0) {
    return {
      eligible: true,
      partiallyEligible: false,
      overridden: false,
      matchedRequirements: [],
      missingRequirements: [],
      message: "No specific requirements set",
    };
  }

  const matchedRequirements = requirementChecks.filter((item) => item.matches).map((item) => item.key);
  const missingRequirements = requirementChecks.filter((item) => !item.matches).map((item) => item.key);

  const eligible = missingRequirements.length === 0;
  const partiallyEligible = !eligible && matchedRequirements.length > 0;

  return {
    eligible,
    partiallyEligible,
    overridden: false,
    matchedRequirements,
    missingRequirements,
    message: eligible
      ? "Eligible based on current qualifications"
      : partiallyEligible
        ? "Partially eligible. Some requirements are missing."
        : "Not eligible. Additional requirements needed.",
  };
}
