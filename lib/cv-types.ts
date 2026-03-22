export type CvEducationInput = {
  id?: string;
  institution: string;
  qualification: string;
  fieldOfStudy?: string | null;
  grade?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  isCurrently?: boolean;
  description?: string | null;
  country?: string | null;
  autoImported?: boolean;
  orderIndex?: number;
};

export type CvWorkExperienceInput = {
  id?: string;
  jobTitle: string;
  employer: string;
  location?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  isCurrently?: boolean;
  responsibilities?: string | null;
  achievements?: string | null;
  orderIndex?: number;
};

export type CvSkillInput = {
  id?: string;
  skillName: string;
  proficiency?: string | null;
  category?: string | null;
  orderIndex?: number;
};

export type CvLanguageInput = {
  id?: string;
  language: string;
  proficiency: string;
  orderIndex?: number;
};

export type CvReferenceInput = {
  id?: string;
  refereeName: string;
  jobTitle?: string | null;
  organisation?: string | null;
  email?: string | null;
  phone?: string | null;
  relationship?: string | null;
  orderIndex?: number;
};

export type CvAchievementInput = {
  id?: string;
  title: string;
  description?: string | null;
  date?: string | null;
  orderIndex?: number;
};

export type CvProfilePayload = {
  id?: string;
  studentId?: string | null;
  fullName?: string | null;
  professionalTitle?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  nationality?: string | null;
  profilePhotoUrl?: string | null;
  profileSummary?: string | null;
  linkedinUrl?: string | null;
  portfolioUrl?: string | null;
  templateStyle?: string | null;
  showReferences?: boolean;
  education?: CvEducationInput[];
  workExperience?: CvWorkExperienceInput[];
  skills?: CvSkillInput[];
  languages?: CvLanguageInput[];
  references?: CvReferenceInput[];
  achievements?: CvAchievementInput[];
};

export type CvCompletionBreakdown = {
  personalInfo: number;
  profileSummary: number;
  education: number;
  workExperience: number;
  skills: number;
  languages: number;
  references: number;
  total: number;
};
