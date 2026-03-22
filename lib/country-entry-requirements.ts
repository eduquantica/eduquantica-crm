import { CourseLevel, ProgrammeLevel } from "@prisma/client";

const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  bangladesh: "BD",
  india: "IN",
  pakistan: "PK",
  nigeria: "NG",
  ghana: "GH",
  nepal: "NP",
  "sri lanka": "LK",
  "united kingdom": "UK",
  uk: "UK",
  usa: "US",
  "united states": "US",
  canada: "CA",
  australia: "AU",
};

export function normalizeCountryCode(value?: string | null): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";

  if (trimmed.length === 2) return trimmed.toUpperCase();

  const mapped = COUNTRY_NAME_TO_CODE[trimmed.toLowerCase()];
  return mapped || trimmed.toUpperCase();
}

export function mapCourseToProgrammeLevel(args: {
  courseLevel: CourseLevel;
  courseName: string;
}): ProgrammeLevel {
  const { courseLevel, courseName } = args;
  const normalizedName = courseName.toLowerCase();

  if (normalizedName.includes("ifp") || normalizedName.includes("international foundation")) {
    return ProgrammeLevel.IFP;
  }
  if (normalizedName.includes("mba")) {
    return ProgrammeLevel.MBA;
  }

  if (courseLevel === CourseLevel.FOUNDATION) return ProgrammeLevel.FOUNDATION;
  if (courseLevel === CourseLevel.MASTERS) return ProgrammeLevel.MASTERS;
  if (courseLevel === CourseLevel.PHD) return ProgrammeLevel.PHD;

  return ProgrammeLevel.UNDERGRADUATE;
}

export type CountryRequirementMatchSource =
  | "country-and-level"
  | "country-all-level"
  | "default-and-level"
  | "default-all-level"
  | "general";

export function findCountryRequirement<T extends { countryCode: string; programmeLevel: ProgrammeLevel }>(args: {
  countryRequirements: T[];
  studentNationality: string | null | undefined;
  programmeLevel: ProgrammeLevel;
}): { requirement: T | null; source: CountryRequirementMatchSource } {
  const { countryRequirements, studentNationality, programmeLevel } = args;
  const studentCountryCode = normalizeCountryCode(studentNationality);

  const exact = countryRequirements.find(
    (item) => item.countryCode === studentCountryCode && item.programmeLevel === programmeLevel,
  );
  if (exact) return { requirement: exact, source: "country-and-level" };

  const countryAll = countryRequirements.find(
    (item) => item.countryCode === studentCountryCode && item.programmeLevel === ProgrammeLevel.ALL,
  );
  if (countryAll) return { requirement: countryAll, source: "country-all-level" };

  const defaultLevel = countryRequirements.find(
    (item) => item.countryCode === "DEFAULT" && item.programmeLevel === programmeLevel,
  );
  if (defaultLevel) return { requirement: defaultLevel, source: "default-and-level" };

  const defaultAll = countryRequirements.find(
    (item) => item.countryCode === "DEFAULT" && item.programmeLevel === ProgrammeLevel.ALL,
  );
  if (defaultAll) return { requirement: defaultAll, source: "default-all-level" };

  return { requirement: null, source: "general" };
}
