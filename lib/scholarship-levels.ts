/**
 * Study levels for scholarships (Scholarship.studyLevels, enum ProgrammeLevel).
 * An empty list means "all levels". Safe to import in client components.
 */
export const SCHOLARSHIP_STUDY_LEVELS = [
  { value: "IFP", label: "International Foundation (IFP)" },
  { value: "FOUNDATION", label: "Foundation" },
  { value: "UNDERGRADUATE", label: "Undergraduate" },
  { value: "MASTERS", label: "Postgraduate (taught Masters)" },
  { value: "MBA", label: "MBA" },
  { value: "MRES", label: "Masters by Research (MRes)" },
  { value: "MPHIL", label: "MPhil" },
  { value: "PHD", label: "PhD" },
  { value: "DBA", label: "DBA" },
] as const;

export type ScholarshipStudyLevel = (typeof SCHOLARSHIP_STUDY_LEVELS)[number]["value"];
