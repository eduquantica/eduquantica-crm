import { db } from "@/lib/db";

export type EduviKnowledgeSeed = {
  category: string;
  title: string;
  content: string;
  tags: string[];
};

export const DEFAULT_EDUVI_KNOWLEDGE_BASE: EduviKnowledgeSeed[] = [
  {
    category: "EduQuantica Services",
    title: "About EduQuantica",
    tags: ["eduquantica", "services", "about"],
    content: [
      "EduQuantica is an international student recruitment consultancy helping students find and apply to universities in the UK, USA, Canada, and Australia.",
      "Services include application management, document verification, visa guidance, pre-CAS interview preparation, and AI powered mock interviews.",
    ].join("\n"),
  },
  {
    category: "UK Universities",
    title: "UK University Applications",
    tags: ["uk", "ucas", "cas", "atas"],
    content: [
      "UCAS is the central application system for UK undergraduate applications.",
      "Postgraduate applications are usually submitted directly to universities.",
      "Application deadlines vary by university and programme.",
      "ATAS certificate is required for some subjects.",
      "CAS is issued after unconditional offer and financial requirements are met.",
      "Student visa application requires a valid CAS number.",
      "IHS surcharge must be paid with visa application.",
    ].join("\n"),
  },
  {
    category: "Visa Information",
    title: "UK Student Visa",
    tags: ["uk", "visa", "student visa", "ihs"],
    content: [
      "Official visa route is Student visa (replaced Tier 4).",
      "Requires unconditional offer from a licensed sponsor and CAS from university.",
      "Financial requirement includes tuition fees and living costs.",
      "Living costs benchmark: £1334/month in London, £1023/month outside London.",
      "English language requirement applies.",
      "Healthcare surcharge is approximately £776 per year.",
      "Standard processing time is around 3 weeks.",
    ].join("\n"),
  },
  {
    category: "US Universities",
    title: "US Student Visa (F-1)",
    tags: ["usa", "f1", "sevis", "i20", "ds160"],
    content: [
      "F-1 visa is the main visa for academic study.",
      "Student must be enrolled in SEVP approved school.",
      "University issues Form I-20.",
      "SEVIS fee must be paid.",
      "DS-160 online application form is required.",
      "Visa interview at US embassy is required.",
      "Financial proof is required for full duration.",
      "OPT may be available after graduation.",
    ].join("\n"),
  },
  {
    category: "Canada Universities",
    title: "Canada Study Permit",
    tags: ["canada", "study permit", "dli", "caq", "pgwp"],
    content: [
      "Study permit is required for courses over 6 months.",
      "Letter of acceptance from designated learning institution (DLI) is required.",
      "Biometrics are required for most nationalities.",
      "Quebec has a separate CAQ process.",
      "PGWP may be available after graduation.",
      "Financial proof is required.",
      "Processing times vary by country.",
    ].join("\n"),
  },
  {
    category: "Australia Universities",
    title: "Australia Student Visa",
    tags: ["australia", "subclass 500", "coe", "oshc", "gte"],
    content: [
      "Subclass 500 is the standard student visa route.",
      "Confirmation of Enrolment (CoE) is required.",
      "OSHC health cover is mandatory.",
      "GTE requirement applies.",
      "Financial capacity must be demonstrated.",
      "English proficiency is required.",
    ].join("\n"),
  },
  {
    category: "Documents Required",
    title: "Commonly Required Documents",
    tags: ["documents", "passport", "sop", "funds"],
    content: [
      "Valid passport with minimum 6 months validity.",
      "Academic transcripts and certificates.",
      "English language test certificate (IELTS/TOEFL/PTE/Duolingo).",
      "Personal statement or SOP.",
      "Usually two reference letters.",
      "CV or resume.",
      "Proof of funds (bank statements).",
      "Sponsor letter if applicable.",
      "Passport photos.",
    ].join("\n"),
  },
  {
    category: "Finance and Fees",
    title: "Fees and Finance Overview",
    tags: ["fees", "finance", "scholarship"],
    content: [
      "UK university fees are typically £10,000 to £38,000 per year.",
      "UK living costs are usually £12,000 to £15,000 per year.",
      "US university fees are typically $20,000 to $60,000 per year.",
      "Canada fees are typically CAD 15,000 to CAD 35,000 per year.",
      "Australia fees are typically AUD 20,000 to AUD 45,000 per year.",
      "Scholarships are available at most universities.",
      "Examples include Chevening (UK), Fulbright (USA), and Vanier (Canada).",
    ].join("\n"),
  },
];

export async function seedEduviKnowledgeBaseIfEmpty(createdBy = "system") {
  const count = await db.eduviKnowledgeBase.count();
  if (count > 0) return;

  await db.eduviKnowledgeBase.createMany({
    data: DEFAULT_EDUVI_KNOWLEDGE_BASE.map((entry) => ({
      category: entry.category,
      title: entry.title,
      content: entry.content,
      tags: entry.tags,
      createdBy,
      isActive: true,
    })),
  });
}

export async function getActiveEduviKnowledgeBase() {
  return db.eduviKnowledgeBase.findMany({
    where: { isActive: true },
    orderBy: [{ category: "asc" }, { updatedAt: "desc" }],
  });
}
