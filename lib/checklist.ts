import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

const TB_REQUIRED_NATIONALITIES = new Set([
  "BD",
  "PK",
  "IN",
  "NG",
  "GH",
  "ET",
  "PH",
  "VN",
]);

const ATAS_KEYWORDS = [
  "science",
  "engineering",
  "technology",
  "physics",
  "chemistry",
  "biology",
  "math",
  "mathematics",
  "computer",
  "ai",
  "robotics",
  "data science",
];

function normalizeCountryCode(value?: string | null): string {
  if (!value) return "";
  const input = value.trim().toUpperCase();
  if (input === "UK" || input === "UNITED KINGDOM" || input === "GB" || input === "GREAT BRITAIN") {
    return "UK";
  }
  if (input === "CANADA" || input === "CA") return "CA";
  if (input === "AUSTRALIA" || input === "AU") return "AU";
  return input;
}

function normalizeNationalityCode(value?: string | null): string {
  if (!value) return "";
  const input = value.trim().toUpperCase();
  const map: Record<string, string> = {
    BANGLADESH: "BD",
    PAKISTAN: "PK",
    INDIA: "IN",
    NIGERIA: "NG",
    GHANA: "GH",
    ETHIOPIA: "ET",
    PHILIPPINES: "PH",
    VIETNAM: "VN",
    UK: "UK",
    "UNITED KINGDOM": "UK",
    "GREAT BRITAIN": "UK",
    CANADA: "CA",
    AUSTRALIA: "AU",
  };

  if (map[input]) return map[input];
  if (/^[A-Z]{2}$/.test(input)) return input;
  return input;
}

function requiresAtas(destinationCountryCode: string, fieldOfStudy?: string | null): boolean {
  if (destinationCountryCode !== "UK") return false;
  if (!fieldOfStudy) return false;
  const value = fieldOfStudy.toLowerCase();
  return ATAS_KEYWORDS.some((keyword) => value.includes(keyword));
}

function evaluateConditionalRequirement(
  conditionRule: string | null,
  nationalityCode: string,
  destinationCountryCode: string,
  fieldOfStudy?: string | null,
): boolean {
  if (!conditionRule) return false;

  if (conditionRule === "TB_REQUIRED_NATIONALITY") {
    return TB_REQUIRED_NATIONALITIES.has(nationalityCode);
  }

  if (conditionRule === "ATAS_REQUIRED_SUBJECT_UK") {
    return requiresAtas(destinationCountryCode, fieldOfStudy);
  }

  return false;
}

export class ChecklistService {
  static async generateChecklist(applicationId: string) {
    const application = await db.application.findUnique({
      where: { id: applicationId },
      include: {
        student: {
          select: {
            id: true,
            nationality: true,
          },
        },
        course: {
          select: {
            level: true,
            fieldOfStudy: true,
          },
        },
        university: {
          select: {
            country: true,
          },
        },
        checklist: {
          include: {
            items: {
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
    });

    if (!application) {
      throw new Error("Application not found");
    }

    if (application.checklist) {
      return application.checklist;
    }

    const destinationCountryCode = normalizeCountryCode(application.university?.country);
    const nationalityCode = normalizeNationalityCode(application.student.nationality);
    const courseLevel = application.course.level;

    if (!destinationCountryCode) {
      throw new Error("Destination country missing on application/university");
    }

    const template = await db.checklistTemplate.findFirst({
      where: {
        countryCode: destinationCountryCode,
        isActive: true,
        OR: [{ courseLevel }, { courseLevel: null }],
      },
      include: {
        items: {
          orderBy: { order: "asc" },
        },
      },
      orderBy: {
        courseLevel: "desc",
      },
    });

    if (!template) {
      throw new Error(
        `No checklist template found for country ${destinationCountryCode} and level ${courseLevel}`,
      );
    }

    return db.$transaction(async (tx) => {
      const createdChecklist = await tx.documentChecklist.create({
        data: {
          applicationId: application.id,
          templateId: template.id,
          studentId: application.studentId,
          destinationCountry: destinationCountryCode,
          courseLevel: String(courseLevel),
        },
      });

      if (template.items.length > 0) {
        await tx.checklistItem.createMany({
          data: template.items.map((item) => {
            const requiredByCondition = item.isConditional
              ? evaluateConditionalRequirement(
                  item.conditionRule,
                  nationalityCode,
                  destinationCountryCode,
                  application.course.fieldOfStudy,
                )
              : item.isRequired;

            return {
              checklistId: createdChecklist.id,
              documentType: item.documentType,
              label: item.name,
              isRequired: requiredByCondition,
              isConditional: item.isConditional,
              conditionalNote: item.conditionRule,
              status: "PENDING" as const,
            } satisfies Prisma.ChecklistItemCreateManyInput;
          }),
        });
      }

      const checklist = await tx.documentChecklist.findUniqueOrThrow({
        where: { id: createdChecklist.id },
        include: {
          items: {
            orderBy: { createdAt: "asc" },
          },
        },
      });

      return checklist;
    });
  }
}
