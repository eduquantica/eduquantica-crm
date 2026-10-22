// Sub-agent business registration: options, form shape and completeness rules.
// Client-safe (no server imports) — used by the agent form, the API and the admin review page.
import { z } from "zod";

type Option = { value: string; label: string };

export const LEGAL_STRUCTURES: Option[] = [
  { value: "SOLE_PROPRIETOR", label: "Sole Proprietor" },
  { value: "PARTNERSHIP", label: "Partnership" },
  { value: "PRIVATE_LIMITED", label: "Private Limited (Pvt. Ltd.)" },
  { value: "LLC", label: "Limited Liability Company" },
  { value: "FRANCHISE_BRANCH", label: "Franchise/Branch of Larger Group" },
  { value: "OTHER", label: "Other" },
];

export const BRITISH_COUNCIL = "BRITISH_COUNCIL";

export const CERTIFICATIONS: Option[] = [
  { value: BRITISH_COUNCIL, label: "British Council" },
  { value: "AIRC", label: "AIRC" },
  { value: "QEAC", label: "QEAC" },
  { value: "ICEF", label: "ICEF" },
  { value: "OTHER", label: "Other" },
];

export const STAFF_COUNTS: Option[] = [
  { value: "1-5", label: "1-5" },
  { value: "6-10", label: "6-10" },
  { value: "11-20", label: "11-20" },
  { value: "21+", label: "21+" },
  { value: "NONE", label: "None" },
];

export const SERVICES: Option[] = [
  { value: "LANGUAGE_TEST_PREP", label: "Language Test Prep (IELTS, TOEFL)" },
  { value: "VISA_COUNSELLING", label: "Visa Counselling" },
  { value: "ACCOMMODATION", label: "Accommodation/Housing Placement" },
  { value: "LOAN_ASSISTANCE", label: "Loan Assistance/Financial Guidance" },
  { value: "PRE_DEPARTURE", label: "Pre-departure Briefings" },
  { value: "CAREER_COUNSELLING", label: "Career Counselling" },
  { value: "POST_GRADUATION_JOBS", label: "Post-graduation Job/Career Help" },
  { value: "OTHER", label: "Other" },
];

export const FEE_MODELS: Option[] = [
  { value: "SERVICE_FEES", label: "Service Fees" },
  { value: "COMMISSION_ONLY", label: "Commission-Only Model" },
];

export const DESTINATIONS: Option[] = [
  { value: "CANADA", label: "Canada" },
  { value: "UNITED_KINGDOM", label: "United Kingdom" },
  { value: "UNITED_STATES", label: "United States" },
  { value: "AUSTRALIA", label: "Australia" },
  { value: "GERMANY", label: "Germany" },
  { value: "IRELAND", label: "Ireland" },
  { value: "NEW_ZEALAND", label: "New Zealand" },
];

export const PROGRAM_TYPES: Option[] = [
  { value: "UNDERGRADUATE", label: "Undergraduate" },
  { value: "POSTGRADUATE", label: "Postgraduate" },
  { value: "VOCATIONAL", label: "Vocational" },
  { value: "LANGUAGE", label: "Language Programs" },
  { value: "OTHER", label: "Other" },
];

export const LEAD_SOURCES: Option[] = [
  { value: "WALK_IN", label: "Walk-in" },
  { value: "WORD_OF_MOUTH", label: "Word of mouth" },
  { value: "SCHOOL_PARTNERSHIPS", label: "Local school partnerships" },
  { value: "SOCIAL_MEDIA_ADS", label: "Social media ads" },
  { value: "EDUCATION_FAIRS", label: "Education fairs or expos" },
  { value: "ONLINE_FORMS", label: "Online forms or website" },
  { value: "SUB_AGENT_REFERRALS", label: "Sub-agent referrals" },
];

export const YEARS_OF_EXPERIENCE: Option[] = [
  { value: "LT_1", label: "Less than 1 year" },
  { value: "1-2", label: "1-2 years" },
  { value: "3-5", label: "3-5 years" },
  { value: "GT_5", label: "More than 5 years" },
];

export const STUDENTS_PLACED: Option[] = [
  { value: "LT_5", label: "Less than 5" },
  { value: "5-10", label: "5-10" },
  { value: "10-50", label: "10-50" },
  { value: "50-100", label: "50-100" },
  { value: "100+", label: "100+" },
];

export const EXPECTED_ENROLMENTS: Option[] = [
  { value: "1-10", label: "1-10" },
  { value: "10-25", label: "10-25" },
  { value: "25-50", label: "25-50" },
  { value: "50-100", label: "50-100" },
  { value: "100+", label: "100+" },
];

export const VISA_APPROVAL_RATES: Option[] = [
  "Below 50%", "50%", "60%", "70%", "80%", "90%", "Above 95%", "Not sure",
].map((label) => ({ value: label, label }));

export const SUB_AGENTS_MANAGED: Option[] = [
  { value: "0", label: "None" },
  { value: "1-5", label: "1-5" },
  { value: "6-20", label: "6-20" },
  { value: "21+", label: "21+" },
];

export const MAX_SOURCE_COUNTRIES = 3;

export const REGISTRATION_STEPS = [
  { step: 1, title: "Company Legitimacy & Compliance" },
  { step: 2, title: "Market Presence & Operation Model" },
  { step: 3, title: "Student Persona & Destination Preferences" },
  { step: 4, title: "Partner Experience & Performance" },
] as const;

export function optionLabel(options: Option[], value: string | null | undefined) {
  if (!value) return null;
  return options.find((option) => option.value === value)?.label ?? value;
}

export function optionLabels(options: Option[], values: string[] | null | undefined) {
  return (values ?? []).map((value) => optionLabel(options, value) ?? value);
}

const text = z.string().trim().max(2000).nullable().optional();
const shortText = z.string().trim().max(300).nullable().optional();
const url = z.string().trim().max(2000).nullable().optional();
const flag = z.boolean().nullable().optional();
const codes = z.array(z.string().trim().max(100)).max(30).optional();

// Shape accepted when saving a draft: every field optional, completeness is checked on submit.
export const registrationDraftSchema = z.object({
  currentStep: z.number().int().min(1).max(4).optional(),

  legalBusinessName: shortText,
  businessRegistrationNumber: shortText,
  certificateIssuingAuthority: shortText,
  yearFounded: z.number().int().min(1800).max(2100).nullable().optional(),
  legalStructure: shortText,
  legalStructureOther: shortText,
  businessCertificateUrl: url,
  certifications: codes,
  certificationsOther: shortText,
  britishCouncilCertificateUrl: url,
  britishCouncilCertificateNumber: shortText,

  ownerFirstName: shortText,
  ownerLastName: shortText,
  coOwners: text,
  ownerIdDocumentUrl: url,
  addressStreet: shortText,
  addressCity: shortText,
  addressState: shortText,
  addressCountry: shortText,
  addressPostalCode: shortText,
  hasPhysicalOffice: flag,
  headOfficeSameAsBusiness: flag,
  headOfficeAddress: text,
  hasAdditionalOffices: flag,
  additionalOfficesDetails: text,
  staffCount: shortText,
  isFranchise: flag,
  franchiseName: shortText,
  servicesOffered: codes,
  servicesOther: shortText,
  feeModel: shortText,

  sourceCountries: codes,
  destinationCountries: codes,
  programTypes: codes,
  programTypesOther: shortText,
  leadSources: codes,

  hasRecruitmentExperience: flag,
  yearsOfExperience: shortText,
  studentsPlacedLast12Months: shortText,
  expectedEnrolments: shortText,
  visaApprovalRate: shortText,
  worksWithAggregators: flag,
  aggregatorsList: text,
  subAgentsManaged: shortText,
  subAgentManagementProcess: text,
  hasOnlinePresence: flag,
  websiteUrl: url,
  linkedinUrl: url,
  facebookUrl: url,
  instagramUrl: url,
  tiktokUrl: url,
  consentAccepted: z.boolean().optional(),
});

export type RegistrationDraft = z.infer<typeof registrationDraftSchema>;

export type RegistrationForm = {
  [K in keyof Required<RegistrationDraft>]-?: NonNullable<RegistrationDraft[K]> extends string[]
    ? string[]
    : NonNullable<RegistrationDraft[K]> extends boolean
      ? K extends "consentAccepted" ? boolean : boolean | null
      : NonNullable<RegistrationDraft[K]> extends number
        ? K extends "currentStep" ? number : number | null
        : string | null;
};

export const EMPTY_REGISTRATION: RegistrationForm = {
  currentStep: 1,
  legalBusinessName: null, businessRegistrationNumber: null, certificateIssuingAuthority: null,
  yearFounded: null, legalStructure: null, legalStructureOther: null, businessCertificateUrl: null,
  certifications: [BRITISH_COUNCIL], certificationsOther: null,
  britishCouncilCertificateUrl: null, britishCouncilCertificateNumber: null,
  ownerFirstName: null, ownerLastName: null, coOwners: null, ownerIdDocumentUrl: null,
  addressStreet: null, addressCity: null, addressState: null, addressCountry: null, addressPostalCode: null,
  hasPhysicalOffice: null, headOfficeSameAsBusiness: null, headOfficeAddress: null,
  hasAdditionalOffices: null, additionalOfficesDetails: null, staffCount: null,
  isFranchise: null, franchiseName: null, servicesOffered: [], servicesOther: null, feeModel: null,
  sourceCountries: [], destinationCountries: [], programTypes: [], programTypesOther: null, leadSources: [],
  hasRecruitmentExperience: null, yearsOfExperience: null, studentsPlacedLast12Months: null,
  expectedEnrolments: null, visaApprovalRate: null, worksWithAggregators: null, aggregatorsList: null,
  subAgentsManaged: null, subAgentManagementProcess: null, hasOnlinePresence: null,
  websiteUrl: null, linkedinUrl: null, facebookUrl: null, instagramUrl: null, tiktokUrl: null,
  consentAccepted: false,
};

/** Picks the form fields out of a stored registration (or returns the empty form). */
export function registrationToForm(record: object | null | undefined): RegistrationForm {
  const source = (record ?? {}) as Record<string, unknown>;
  const form = { ...EMPTY_REGISTRATION } as Record<string, unknown>;
  for (const key of Object.keys(EMPTY_REGISTRATION)) {
    if (source[key] !== undefined && source[key] !== null) form[key] = source[key];
  }
  return form as RegistrationForm;
}

export type MissingField ={ step: 1 | 2 | 3 | 4; field: keyof RegistrationForm; message: string };

const blank = (value: string | null | undefined) => !value || !value.trim();

/** Everything still needed before the registration can be submitted, grouped by step. */
export function getMissingFields(form: RegistrationForm): MissingField[] {
  const missing: MissingField[] = [];
  const need = (step: MissingField["step"], field: keyof RegistrationForm, ok: boolean, message: string) => {
    if (!ok) missing.push({ step, field, message });
  };
  const thisYear = new Date().getFullYear();

  need(1, "legalBusinessName", !blank(form.legalBusinessName), "Legal business name");
  need(1, "businessRegistrationNumber", !blank(form.businessRegistrationNumber), "Business registration number");
  need(1, "certificateIssuingAuthority", !blank(form.certificateIssuingAuthority), "Certificate issuing authority");
  need(1, "yearFounded", Boolean(form.yearFounded && form.yearFounded >= 1800 && form.yearFounded <= thisYear), "Year founded (4-digit year)");
  need(1, "legalStructure", !blank(form.legalStructure), "Agency legal structure");
  if (form.legalStructure === "OTHER") need(1, "legalStructureOther", !blank(form.legalStructureOther), "Describe your legal structure");
  need(1, "businessCertificateUrl", !blank(form.businessCertificateUrl), "Business certificate upload");
  need(1, "certifications", form.certifications.includes(BRITISH_COUNCIL), "British Council certification");
  need(1, "britishCouncilCertificateUrl", !blank(form.britishCouncilCertificateUrl), "British Council agent certificate upload");
  if (form.certifications.includes("OTHER")) need(1, "certificationsOther", !blank(form.certificationsOther), "Name your other certification");

  need(2, "ownerFirstName", !blank(form.ownerFirstName), "Owner's first name");
  need(2, "ownerLastName", !blank(form.ownerLastName), "Owner's last name");
  need(2, "coOwners", !blank(form.coOwners), "Co-owners/partners (write \"None\" if there are none)");
  need(2, "ownerIdDocumentUrl", !blank(form.ownerIdDocumentUrl), "Owner's government-issued ID upload");
  need(2, "addressStreet", !blank(form.addressStreet), "Business street address");
  need(2, "addressCity", !blank(form.addressCity), "Business city");
  need(2, "addressState", !blank(form.addressState), "Business province/state");
  need(2, "addressCountry", !blank(form.addressCountry), "Business country");
  need(2, "addressPostalCode", !blank(form.addressPostalCode), "Business postal code");
  need(2, "hasPhysicalOffice", form.hasPhysicalOffice !== null, "Whether you operate physical offices");
  if (form.hasPhysicalOffice) {
    need(2, "headOfficeSameAsBusiness", form.headOfficeSameAsBusiness !== null, "Whether your head office is at the business address");
    if (form.headOfficeSameAsBusiness === false) need(2, "headOfficeAddress", !blank(form.headOfficeAddress), "Head office address");
    need(2, "hasAdditionalOffices", form.hasAdditionalOffices !== null, "Whether you have additional offices");
    if (form.hasAdditionalOffices) need(2, "additionalOfficesDetails", !blank(form.additionalOfficesDetails), "Additional office locations");
  }
  need(2, "staffCount", !blank(form.staffCount), "Number of staff/counsellors");
  if (form.isFranchise) need(2, "franchiseName", !blank(form.franchiseName), "Franchise or parent network name");
  need(2, "servicesOffered", form.servicesOffered.length > 0, "Services you offer");
  if (form.servicesOffered.includes("OTHER")) need(2, "servicesOther", !blank(form.servicesOther), "Describe your other services");
  need(2, "feeModel", !blank(form.feeModel), "Service fees or commission-only model");

  need(3, "sourceCountries", form.sourceCountries.length > 0 && form.sourceCountries.length <= MAX_SOURCE_COUNTRIES, `Countries you recruit from (1 to ${MAX_SOURCE_COUNTRIES})`);
  need(3, "destinationCountries", form.destinationCountries.length > 0, "Countries you send students to");
  need(3, "programTypes", form.programTypes.length > 0, "Program types");
  if (form.programTypes.includes("OTHER")) need(3, "programTypesOther", !blank(form.programTypesOther), "Describe your other program types");

  need(4, "hasRecruitmentExperience", form.hasRecruitmentExperience !== null, "Student recruitment experience");
  if (form.hasRecruitmentExperience) {
    need(4, "yearsOfExperience", !blank(form.yearsOfExperience), "Years of experience");
    need(4, "studentsPlacedLast12Months", !blank(form.studentsPlacedLast12Months), "Students placed in the past 12 months");
  }
  need(4, "expectedEnrolments", !blank(form.expectedEnrolments), "Expected enrolments in the upcoming year");
  need(4, "worksWithAggregators", form.worksWithAggregators !== null, "Whether you work with other aggregators or sub-agents");
  if (form.worksWithAggregators) need(4, "aggregatorsList", !blank(form.aggregatorsList), "The aggregators or sub-agents you work with");
  need(4, "subAgentsManaged", !blank(form.subAgentsManaged), "Number of sub-agents you manage");
  if (form.hasOnlinePresence) {
    const links = [form.websiteUrl, form.linkedinUrl, form.facebookUrl, form.instagramUrl, form.tiktokUrl];
    need(4, "websiteUrl", links.some((link) => !blank(link)), "At least one website or social media link");
  }
  need(4, "consentAccepted", form.consentAccepted, "Consent to the terms and declaration");

  return missing;
}

type AgentStatus = "PENDING" | "INFO_REQUESTED" | "APPROVED" | "REJECTED";

/**
 * Agents can edit until they submit, and again when the admin asks for more information.
 * Partners approved before registration existed can still complete it once.
 */
export function isRegistrationEditable(status: AgentStatus, submittedAt: Date | string | null | undefined) {
  if (status === "INFO_REQUESTED") return true;
  return (status === "PENDING" || status === "APPROVED") && !submittedAt;
}
