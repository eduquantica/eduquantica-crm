import { CountryQualificationType, type QualType, type StudentQualification } from "@prisma/client";

export const COUNTRY_QUALIFICATION_LABELS: Record<CountryQualificationType, string> = {
  UK_ALEVEL: "A-Level",
  UK_GCSE: "GCSE",
  UK_BTEC: "BTEC",
  IB_DIPLOMA: "IB Diploma",
  BANGLADESH_SSC: "Bangladesh SSC (Year 10)",
  BANGLADESH_HSC: "Bangladesh HSC (Year 12)",
  INDIA_CLASS10: "India Class 10 (CBSE/ICSE)",
  INDIA_CLASS12: "India Class 12 (CBSE/ICSE)",
  PAKISTAN_MATRIC: "Pakistan Matriculation",
  PAKISTAN_FSCINTERMEDIATE: "Pakistan FSc/Intermediate",
  NIGERIA_WAEC: "Nigeria WAEC/NECO",
  NIGERIA_JAMB: "Nigeria JAMB",
  US_HIGHSCHOOL: "US High School Diploma",
  US_AP: "US Advanced Placement",
  CANADA_HIGHSCHOOL: "Canada High School Diploma",
  AUSTRALIA_YEAR12: "Australia Year 12",
  MALAYSIA_STPM: "Malaysia STPM",
  SRI_LANKA_AL: "Sri Lanka A-Level",
  NEPAL_SLC: "Nepal SLC/SEE",
  OTHER: "Other (specify)",
};

const TOKEN_MAP: Array<{ tokens: string[]; value: CountryQualificationType }> = [
  { tokens: ["gce a level", "a level", "alevel", "a-level", "advanced level"], value: CountryQualificationType.UK_ALEVEL },
  { tokens: ["gcse"], value: CountryQualificationType.UK_GCSE },
  { tokens: ["btec"], value: CountryQualificationType.UK_BTEC },
  { tokens: ["ib diploma", "international baccalaureate", "ib"], value: CountryQualificationType.IB_DIPLOMA },
  { tokens: ["hsc", "higher secondary", "year 12", "class 12"], value: CountryQualificationType.BANGLADESH_HSC },
  { tokens: ["ssc", "secondary school certificate", "year 10", "class 10"], value: CountryQualificationType.BANGLADESH_SSC },
  { tokens: ["matric", "matriculation"], value: CountryQualificationType.PAKISTAN_MATRIC },
  { tokens: ["fsc", "intermediate"], value: CountryQualificationType.PAKISTAN_FSCINTERMEDIATE },
  { tokens: ["waec", "neco"], value: CountryQualificationType.NIGERIA_WAEC },
  { tokens: ["jamb"], value: CountryQualificationType.NIGERIA_JAMB },
  { tokens: ["high school diploma", "high school"], value: CountryQualificationType.US_HIGHSCHOOL },
  { tokens: ["advanced placement", "ap"], value: CountryQualificationType.US_AP },
  { tokens: ["stpm"], value: CountryQualificationType.MALAYSIA_STPM },
  { tokens: ["sri lanka a level"], value: CountryQualificationType.SRI_LANKA_AL },
  { tokens: ["slc", "see"], value: CountryQualificationType.NEPAL_SLC },
];

const QUAL_TYPE_MAP: Partial<Record<QualType, CountryQualificationType[]>> = {
  GCSE: [CountryQualificationType.UK_GCSE],
  A_LEVEL: [CountryQualificationType.UK_ALEVEL, CountryQualificationType.SRI_LANKA_AL],
  BTEC: [CountryQualificationType.UK_BTEC],
  IB: [CountryQualificationType.IB_DIPLOMA],
  SSC: [CountryQualificationType.BANGLADESH_SSC, CountryQualificationType.INDIA_CLASS10],
  HSC: [CountryQualificationType.BANGLADESH_HSC, CountryQualificationType.INDIA_CLASS12],
  O_LEVEL: [CountryQualificationType.PAKISTAN_MATRIC],
  WAEC: [CountryQualificationType.NIGERIA_WAEC],
  NECO: [CountryQualificationType.NIGERIA_WAEC],
  FOUNDATION: [CountryQualificationType.OTHER],
};

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ");
}

export function normalizeCountryQualificationType(input: string, studentNationality?: string | null): CountryQualificationType {
  const normalized = normalizeText(input);
  const nationality = (studentNationality || "").trim().toUpperCase();

  if (normalized.includes("year 12")) {
    if (nationality === "AU" || nationality === "AUSTRALIA") return CountryQualificationType.AUSTRALIA_YEAR12;
    return CountryQualificationType.BANGLADESH_HSC;
  }

  if (normalized.includes("year 10")) {
    return CountryQualificationType.BANGLADESH_SSC;
  }

  for (const row of TOKEN_MAP) {
    if (row.tokens.some((token) => normalized.includes(token))) {
      return row.value;
    }
  }

  return CountryQualificationType.OTHER;
}

export function countryQualificationCandidatesFromStudentQualification(
  qualification: Pick<StudentQualification, "qualType" | "qualName">,
  studentNationality?: string | null,
): CountryQualificationType[] {
  const fromQualType = QUAL_TYPE_MAP[qualification.qualType] || [];
  const fromName = qualification.qualName
    ? [normalizeCountryQualificationType(qualification.qualName, studentNationality)]
    : [];

  return Array.from(new Set([...fromQualType, ...fromName]));
}
