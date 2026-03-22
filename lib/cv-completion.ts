import type { CvCompletionBreakdown } from "@/lib/cv-types";

type CvCompletionInput = {
  fullName?: string | null;
  email?: string | null;
  professionalTitle?: string | null;
  phone?: string | null;
  country?: string | null;
  profileSummary?: string | null;
  educationCount: number;
  workExperienceCount: number;
  skillsCount: number;
  languagesCount: number;
  referencesCount: number;
};

export function calculateCvCompletion(input: CvCompletionInput): CvCompletionBreakdown {
  const personalInfoFilled = Boolean(
    input.fullName?.trim() && input.email?.trim() && (input.professionalTitle?.trim() || input.phone?.trim() || input.country?.trim()),
  );
  const summaryFilled = Boolean(input.profileSummary?.trim());

  const personalInfo = personalInfoFilled ? 20 : 0;
  const profileSummary = summaryFilled ? 15 : 0;
  const education = input.educationCount > 0 ? 20 : 0;
  const workExperience = input.workExperienceCount > 0 ? 15 : 0;
  const skills = input.skillsCount >= 3 ? 10 : 0;
  const languages = input.languagesCount > 0 ? 10 : 0;
  const references = input.referencesCount > 0 ? 10 : 0;

  return {
    personalInfo,
    profileSummary,
    education,
    workExperience,
    skills,
    languages,
    references,
    total: personalInfo + profileSummary + education + workExperience + skills + languages + references,
  };
}
