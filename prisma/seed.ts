// Load env vars before PrismaClient is instantiated
import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });

import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_FINANCIAL_REQUIREMENTS } from "./../lib/financial-requirements";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ─── Module definitions ───────────────────────────────────────────────────────

const MODULES = [
  "leads",
  "students",
  "applications",
  "universities",
  "courses",
  "sub-agents",
  "communications",
  "tasks",
  "commissions",
  "visa",
  "documents",
  "reports",
  "settings",
] as const;

type Module = (typeof MODULES)[number];

interface PermissionDef {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

// ─── Permission presets ───────────────────────────────────────────────────────

const FULL: PermissionDef = { canView: true, canCreate: true, canEdit: true, canDelete: true };
const VIEW_EDIT: PermissionDef = { canView: true, canCreate: false, canEdit: true, canDelete: false };
const VIEW_CREATE_EDIT: PermissionDef = { canView: true, canCreate: true, canEdit: true, canDelete: false };
const VIEW_ONLY: PermissionDef = { canView: true, canCreate: false, canEdit: false, canDelete: false };
const NONE: PermissionDef = { canView: false, canCreate: false, canEdit: false, canDelete: false };

const allModules = (perm: PermissionDef): Record<Module, PermissionDef> =>
  Object.fromEntries(MODULES.map((m) => [m, perm])) as Record<Module, PermissionDef>;

// ─── Role seed definitions ────────────────────────────────────────────────────

interface RoleSeed {
  name: string;
  label: string;
  permissions: Record<Module, PermissionDef>;
}

const ROLES: RoleSeed[] = [
  {
    name: "ADMIN",
    label: "Admin",
    permissions: allModules(FULL),
  },
  {
    name: "MANAGER",
    label: "Manager",
    permissions: {
      leads:          VIEW_EDIT,
      students:       VIEW_EDIT,
      applications:   VIEW_EDIT,
      universities:   VIEW_EDIT,
      courses:        VIEW_EDIT,
      "sub-agents":   VIEW_EDIT,
      communications: VIEW_EDIT,
      tasks:          VIEW_EDIT,
      commissions:    VIEW_EDIT,
      visa:           VIEW_EDIT,
      documents:      VIEW_EDIT,
      reports:        VIEW_EDIT,
      settings:       NONE,       // managers have no access to settings
    },
  },
  {
    name: "COUNSELLOR",
    label: "Counsellor",
    permissions: {
      leads:          VIEW_CREATE_EDIT,
      students:       VIEW_CREATE_EDIT,
      applications:   VIEW_CREATE_EDIT,
      universities:   VIEW_ONLY,
      courses:        VIEW_ONLY,
      "sub-agents":   NONE,
      communications: VIEW_CREATE_EDIT,
      tasks:          VIEW_CREATE_EDIT,
      commissions:    NONE,
      visa:           VIEW_CREATE_EDIT,
      documents:      VIEW_CREATE_EDIT,
      reports:        NONE,
      settings:       NONE,
    },
  },
  {
    // Student portal is separate — no dashboard module access
    name: "STUDENT",
    label: "Student",
    permissions: allModules(NONE),
  },
  {
    // Agent portal is separate — no dashboard module access
    name: "SUB_AGENT",
    label: "Sub-Agent",
    permissions: allModules(NONE),
  },
  {
    name: "BRANCH_MANAGER",
    label: "Branch Manager",
    permissions: {
      leads:          VIEW_EDIT,
      students:       VIEW_EDIT,
      applications:   VIEW_EDIT,
      universities:   VIEW_ONLY,
      courses:        VIEW_ONLY,
      "sub-agents":   VIEW_EDIT,
      communications: VIEW_EDIT,
      tasks:          VIEW_EDIT,
      commissions:    VIEW_EDIT,
      visa:           VIEW_EDIT,
      documents:      VIEW_EDIT,
      reports:        VIEW_EDIT,
      settings:       NONE,
    },
  },
  {
    name: "SUB_AGENT_COUNSELLOR",
    label: "Sub-Agent Counsellor",
    permissions: {
      leads:          VIEW_CREATE_EDIT,
      students:       VIEW_CREATE_EDIT,
      applications:   VIEW_CREATE_EDIT,
      universities:   VIEW_ONLY,
      courses:        VIEW_ONLY,
      "sub-agents":   NONE,
      communications: VIEW_CREATE_EDIT,
      tasks:          VIEW_CREATE_EDIT,
      commissions:    NONE,
      visa:           VIEW_CREATE_EDIT,
      documents:      VIEW_CREATE_EDIT,
      reports:        NONE,
      settings:       NONE,
    },
  },
];

// ─── Seed logic ───────────────────────────────────────────────────────────────

async function main() {
  console.log("Seeding RBAC roles and permissions…\n");

  for (const roleDef of ROLES) {
    const role = await prisma.role.upsert({
      where: { name: roleDef.name },
      update: { label: roleDef.label, isBuiltIn: true },
      create: { name: roleDef.name, label: roleDef.label, isBuiltIn: true },
    });

    for (const module of MODULES) {
      const perm = roleDef.permissions[module];
      await prisma.permission.upsert({
        where: { roleId_module: { roleId: role.id, module } },
        update: perm,
        create: { roleId: role.id, module, ...perm },
      });
    }

    const granted = MODULES.filter((m) => roleDef.permissions[m].canView);
    console.log(`  ✓ ${roleDef.label.padEnd(12)} — view access on: ${granted.join(", ") || "none (portal role)"}`);
  }

  console.log("\nSeeding complete.");

  const testTypeDefaults = [
    { name: "IELTS Academic", isIELTS: true },
    { name: "IELTS General Training", isIELTS: true },
    { name: "TOEFL iBT", isIELTS: false },
    { name: "PTE Academic", isIELTS: false },
    { name: "Duolingo English Test", isIELTS: false },
    { name: "OET", isIELTS: false },
    { name: "Cambridge B2/C1/C2", isIELTS: false },
  ] as const;

  const existingTestTypeCount = await prisma.testType.count();
  if (existingTestTypeCount === 0) {
    await prisma.testType.createMany({
      data: testTypeDefaults.map((item) => ({
        name: item.name,
        isIELTS: item.isIELTS,
        isActive: true,
      })),
      skipDuplicates: true,
    });
    console.log("Default test types seeded.");
  }

  // ─── Email template defaults ─────────────────────────────────────────────
  console.log("\nSeeding default email templates…");
  // import templates dynamically to avoid circular at top of file
  const emailTemplates = (await import("./../lib/email-templates")).default;
  const placeholderData = {
    studentName: "{{student_name}}",
    courseName: "{{course_name}}",
    universityName: "{{university_name}}",
    counsellorName: "{{counsellor_name}}",
  } as const;

  const transform = (fn: Function) => {
    const { subject, html } = fn(
      placeholderData.studentName,
      placeholderData.courseName,
      placeholderData.universityName,
      placeholderData.counsellorName
    );
    return { subject, body: html };
  };

  for (const [key, fn] of Object.entries(emailTemplates) as [string, Function][]) {
    const { subject, body } = transform(fn);
    await prisma.emailTemplate.upsert({
      where: { name: key },
      update: { subject, body },
      create: { name: key, subject, body },
    });
    console.log(`  • template ${key}`);
  }

  console.log("Email template seeding complete.");

  console.log("Seeding checklist templates...");

  const checklistTemplates = [
    {
      countryCode: "UK",
      countryName: "United Kingdom",
      courseLevel: null,
      title: "UK Student Visa Checklist",
      items: [
        { name: "Valid Passport", description: "Passport must be valid for travel and visa processing.", documentType: "PASSPORT", isRequired: true, isConditional: false, conditionRule: null },
        { name: "CAS Letter from University", description: "Confirmation of Acceptance for Studies (CAS).", documentType: "VISA_DOCUMENT", isRequired: true, isConditional: false, conditionRule: null },
        { name: "Unconditional Offer Letter", description: "Official unconditional offer from university.", documentType: "OTHER", isRequired: true, isConditional: false, conditionRule: null },
        { name: "Academic Transcripts", description: "Official transcripts from previous studies.", documentType: "TRANSCRIPT", isRequired: true, isConditional: false, conditionRule: null },
        { name: "Academic Certificates/Diplomas", description: "Degree certificate or diploma award documents.", documentType: "DEGREE_CERT", isRequired: true, isConditional: false, conditionRule: null },
        { name: "English Language Test Results IELTS/TOEFL/PTE", description: "Accepted English language proficiency results.", documentType: "ENGLISH_TEST", isRequired: true, isConditional: false, conditionRule: null },
        { name: "Bank Statements - 28 consecutive days", description: "Bank statements proving required maintenance funds.", documentType: "FINANCIAL_PROOF", isRequired: true, isConditional: false, conditionRule: null },
        { name: "Bank Statement Covering Letter", description: "Bank letter validating statement authenticity and balance.", documentType: "FINANCIAL_PROOF", isRequired: true, isConditional: false, conditionRule: null },
        { name: "TB Test Certificate", description: "Required only for specific nationalities.", documentType: "VISA_DOCUMENT", isRequired: false, isConditional: true, conditionRule: "TB_REQUIRED_NATIONALITY" },
        { name: "ATAS Certificate", description: "Required for certain UK science/engineering subjects.", documentType: "VISA_DOCUMENT", isRequired: false, isConditional: true, conditionRule: "ATAS_REQUIRED_SUBJECT_UK" },
        { name: "Passport-Size Photographs", description: "Passport compliant photograph(s).", documentType: "PHOTO", isRequired: true, isConditional: false, conditionRule: null },
        { name: "Personal Statement", description: "Personal statement supporting visa and admission profile.", documentType: "PERSONAL_STATEMENT", isRequired: true, isConditional: false, conditionRule: null },
      ],
    },
    {
      countryCode: "CA",
      countryName: "Canada",
      courseLevel: null,
      title: "Canada Student Visa Checklist",
      items: [
        { name: "Valid Passport", description: "Passport must be valid for study permit processing.", documentType: "PASSPORT", isRequired: true, isConditional: false, conditionRule: null },
        { name: "Acceptance Letter", description: "Acceptance letter from designated learning institution.", documentType: "OTHER", isRequired: true, isConditional: false, conditionRule: null },
        { name: "Study Permit Application Form", description: "Completed study permit application forms.", documentType: "VISA_DOCUMENT", isRequired: true, isConditional: false, conditionRule: null },
        { name: "Financial Evidence (3 months bank statements)", description: "Proof of funds and bank statements for minimum 3 months.", documentType: "FINANCIAL_PROOF", isRequired: true, isConditional: false, conditionRule: null },
        { name: "Academic Transcripts", description: "Official academic transcripts.", documentType: "TRANSCRIPT", isRequired: true, isConditional: false, conditionRule: null },
        { name: "English Test Results", description: "Accepted language test results.", documentType: "ENGLISH_TEST", isRequired: true, isConditional: false, conditionRule: null },
        { name: "Passport Photos", description: "Recent passport-size photographs.", documentType: "PHOTO", isRequired: true, isConditional: false, conditionRule: null },
        { name: "Medical Exam", description: "Medical exam report if required by visa office.", documentType: "VISA_DOCUMENT", isRequired: false, isConditional: true, conditionRule: "IF_REQUIRED" },
      ],
    },
    {
      countryCode: "AU",
      countryName: "Australia",
      courseLevel: null,
      title: "Australia Student Visa Checklist",
      items: [
        { name: "Valid Passport", description: "Passport valid for visa duration.", documentType: "PASSPORT", isRequired: true, isConditional: false, conditionRule: null },
        { name: "Confirmation of Enrolment (CoE)", description: "Confirmation of Enrolment from provider.", documentType: "VISA_DOCUMENT", isRequired: true, isConditional: false, conditionRule: null },
        { name: "Overseas Student Health Cover (OSHC)", description: "Valid OSHC policy details.", documentType: "VISA_DOCUMENT", isRequired: true, isConditional: false, conditionRule: null },
        { name: "Financial Evidence", description: "Proof of tuition, travel, and living funds.", documentType: "FINANCIAL_PROOF", isRequired: true, isConditional: false, conditionRule: null },
        { name: "Academic Transcripts", description: "Official academic records.", documentType: "TRANSCRIPT", isRequired: true, isConditional: false, conditionRule: null },
        { name: "English Test Results", description: "English proficiency test results.", documentType: "ENGLISH_TEST", isRequired: true, isConditional: false, conditionRule: null },
        { name: "Genuine Temporary Entrant statement", description: "Statement addressing GTE/GS requirements.", documentType: "PERSONAL_STATEMENT", isRequired: true, isConditional: false, conditionRule: null },
        { name: "Health Examination", description: "Health examination report where required.", documentType: "VISA_DOCUMENT", isRequired: true, isConditional: false, conditionRule: null },
      ],
    },
  ] as const;

  for (const template of checklistTemplates) {
    const savedTemplate = template.courseLevel
      ? await prisma.checklistTemplate.upsert({
          where: {
            countryCode_courseLevel: {
              countryCode: template.countryCode,
              courseLevel: template.courseLevel,
            },
          },
          update: {
            countryName: template.countryName,
            title: template.title,
            isActive: true,
          },
          create: {
            countryCode: template.countryCode,
            countryName: template.countryName,
            courseLevel: template.courseLevel,
            title: template.title,
            isActive: true,
          },
          select: { id: true },
        })
      : (() => undefined)();

    const templateForNullCourseLevel = !template.courseLevel
      ? await prisma.checklistTemplate.findFirst({
          where: {
            countryCode: template.countryCode,
            courseLevel: null,
          },
          select: { id: true },
        })
      : null;

    const savedTemplateRecord = savedTemplate
      ?? (templateForNullCourseLevel
        ? await prisma.checklistTemplate.update({
            where: { id: templateForNullCourseLevel.id },
            data: {
              countryName: template.countryName,
              title: template.title,
              isActive: true,
            },
            select: { id: true },
          })
        : await prisma.checklistTemplate.create({
            data: {
              countryCode: template.countryCode,
              countryName: template.countryName,
              courseLevel: null,
              title: template.title,
              isActive: true,
            },
            select: { id: true },
          }));

    for (let index = 0; index < template.items.length; index += 1) {
      const item = template.items[index];
      await prisma.checklistTemplateItem.upsert({
        where: {
          templateId_order: {
            templateId: savedTemplateRecord.id,
            order: index + 1,
          },
        },
        update: {
          name: item.name,
          description: item.description,
          documentType: item.documentType,
          isRequired: item.isRequired,
          isConditional: item.isConditional,
          conditionRule: item.conditionRule,
        },
        create: {
          templateId: savedTemplateRecord.id,
          order: index + 1,
          name: item.name,
          description: item.description,
          documentType: item.documentType,
          isRequired: item.isRequired,
          isConditional: item.isConditional,
          conditionRule: item.conditionRule,
        },
      });
    }

    await prisma.checklistTemplateItem.deleteMany({
      where: {
        templateId: savedTemplateRecord.id,
        order: { gt: template.items.length },
      },
    });
  }

  console.log("Checklist template seeding complete.");

  const existingScanSettings = await prisma.scanSettings.findFirst({ select: { id: true } });
  if (!existingScanSettings) {
    await prisma.scanSettings.create({
      data: {
        plagiarismGreenMax: 15,
        plagiarismAmberMax: 30,
        aiGreenMax: 20,
        aiAmberMax: 40,
        autoApproveGreen: false,
      },
    });
    console.log("Default scan settings seeded.");
  }

  for (const rule of DEFAULT_FINANCIAL_REQUIREMENTS) {
    await prisma.livingCostCountry.upsert({
      where: { countryCode: rule.countryCode },
      update: {
        countryName: rule.countryName,
        currency: rule.currency,
        monthlyLivingCost: rule.monthlyLivingCost,
        defaultMonths: rule.defaultMonths,
        rulesJson: rule.rules,
      },
      create: {
        countryCode: rule.countryCode,
        countryName: rule.countryName,
        currency: rule.currency,
        monthlyLivingCost: rule.monthlyLivingCost,
        defaultMonths: rule.defaultMonths,
        rulesJson: rule.rules,
      },
    });
  }
  console.log("Default living cost countries seeded.");

  console.log("Seeding initial currency rates...");
  const seededAt = new Date();
  const initialRates = [
    { baseCurrency: "GBP", targetCurrency: "USD", rate: 1.28 },
    { baseCurrency: "GBP", targetCurrency: "CAD", rate: 1.72 },
    { baseCurrency: "GBP", targetCurrency: "AUD", rate: 1.95 },
    { baseCurrency: "GBP", targetCurrency: "EUR", rate: 1.17 },
    { baseCurrency: "GBP", targetCurrency: "BDT", rate: 133 },
    { baseCurrency: "GBP", targetCurrency: "INR", rate: 107 },
    { baseCurrency: "GBP", targetCurrency: "NGN", rate: 1983 },
    { baseCurrency: "GBP", targetCurrency: "PKR", rate: 281 },
    { baseCurrency: "USD", targetCurrency: "BDT", rate: 110 },
    { baseCurrency: "CAD", targetCurrency: "BDT", rate: 81 },
    { baseCurrency: "AUD", targetCurrency: "BDT", rate: 73 },
    { baseCurrency: "EUR", targetCurrency: "BDT", rate: 120 },
  ];

  for (const entry of initialRates) {
    await prisma.currencyRate.upsert({
      where: {
        baseCurrency_targetCurrency: {
          baseCurrency: entry.baseCurrency,
          targetCurrency: entry.targetCurrency,
        },
      },
      update: {
        rate: entry.rate,
        source: "seed",
        fetchedAt: seededAt,
      },
      create: {
        baseCurrency: entry.baseCurrency,
        targetCurrency: entry.targetCurrency,
        rate: entry.rate,
        source: "seed",
        fetchedAt: seededAt,
      },
    });
  }
  console.log(`Seeded ${initialRates.length} currency rates.`);

  const userSeeds = [
    {
      roleName: "ADMIN",
      email: "admin@eduquantica.com",
      password: "Admin123!",
      name: "EduQuantica Admin",
      phone: "+44 7000 000001",
    },
    {
      roleName: "MANAGER",
      email: "manager@eduquantica.com",
      password: "Manager123!",
      name: "EduQuantica Manager",
      phone: "+44 7000 000002",
    },
    {
      roleName: "COUNSELLOR",
      email: "counsellor@eduquantica.com",
      password: "Counsellor123!",
      name: "EduQuantica Counsellor",
      phone: "+44 7000 000003",
    },
    {
      roleName: "SUB_AGENT",
      email: "agent@eduquantica.com",
      password: "Agent123!",
      name: "EduQuantica Agent",
      phone: "+44 7000 000004",
    },
    {
      roleName: "STUDENT",
      email: "student@eduquantica.com",
      password: "Student123!",
      name: "EduQuantica Student",
      phone: "+44 7000 000005",
    },
    {
      roleName: "BRANCH_MANAGER",
      email: "branchmanager@eduquantica.com",
      password: "BranchManager123!",
      name: "Branch Manager User",
      phone: "+44 7000 000006",
    },
    {
      roleName: "SUB_AGENT_COUNSELLOR",
      email: "agentcounsellor@eduquantica.com",
      password: "AgentCounsellor123!",
      name: "Agent Counsellor User",
      phone: "+44 7000 000007",
    },
  ] as const;

  const seededUsers = new Map<string, { id: string; email: string }>();

  for (const entry of userSeeds) {
    const hash = await bcrypt.hash(entry.password, 12);
    const user = await prisma.user.upsert({
      where: { email: entry.email },
      update: {
        name: entry.name,
        phone: entry.phone,
        password: hash,
        isActive: true,
        role: { connect: { name: entry.roleName } },
      },
      create: {
        email: entry.email,
        name: entry.name,
        phone: entry.phone,
        password: hash,
        isActive: true,
        role: { connect: { name: entry.roleName } },
      },
      select: { id: true, email: true },
    });
    seededUsers.set(entry.roleName, user);
  }

  console.log("Ensured foundation test accounts (ADMIN, MANAGER, COUNSELLOR, SUB_AGENT, STUDENT).");

  const agentUser = seededUsers.get("SUB_AGENT");
  if (agentUser) {
    await prisma.subAgent.upsert({
      where: { userId: agentUser.id },
      update: {
        agencyName: "Global Pathways Agency",
        firstName: "Partner",
        lastName: "Agent",
        businessEmail: agentUser.email,
        phone: "+44 7900 000111",
        agencyCountry: "United Kingdom",
        agencyCity: "London",
        referralCode: "AGENT2026",
        isApproved: true,
        approvalStatus: "APPROVED",
        approvedAt: new Date(),
      },
      create: {
        userId: agentUser.id,
        agencyName: "Global Pathways Agency",
        firstName: "Partner",
        lastName: "Agent",
        businessEmail: agentUser.email,
        phone: "+44 7900 000111",
        agencyCountry: "United Kingdom",
        agencyCity: "London",
        referralCode: "AGENT2026",
        isApproved: true,
        approvalStatus: "APPROVED",
        approvedAt: new Date(),
      },
      select: { id: true },
    });
  }

  const studentUser = seededUsers.get("STUDENT");
  const counsellorUser = seededUsers.get("COUNSELLOR");
  if (studentUser) {
    await prisma.student.upsert({
      where: { userId: studentUser.id },
      update: {
        firstName: "Demo",
        lastName: "Student",
        email: "student@eduquantica.com",
        phone: "+44 7000 000005",
        nationality: "Bangladesh",
        country: "United Kingdom",
        preferredCurrency: "GBP",
        onboardingCompleted: true,
        recentlyViewedCourses: ["Computer Science", "MBA"],
        assignedCounsellorId: counsellorUser?.id ?? null,
      },
      create: {
        userId: studentUser.id,
        firstName: "Demo",
        lastName: "Student",
        email: "student@eduquantica.com",
        phone: "+44 7000 000005",
        nationality: "Bangladesh",
        country: "United Kingdom",
        preferredCurrency: "GBP",
        onboardingCompleted: true,
        recentlyViewedCourses: ["Computer Science", "MBA"],
        assignedCounsellorId: counsellorUser?.id ?? null,
      },
      select: { id: true },
    });
  }

  const universitySeeds = [
    {
      id: "seed-uni-northbridge",
      name: "University of Northbridge",
      country: "United Kingdom",
      city: "London",
      website: "https://example.edu/northbridge",
      logo: "/images/universities/northbridge.png",
      description: "A modern UK university focused on employability and innovation.",
      currency: "GBP",
      contactEmail: "admissions@northbridge.example",
    },
    {
      id: "seed-uni-maple-international",
      name: "Maple International University",
      country: "Canada",
      city: "Toronto",
      website: "https://example.edu/maple",
      logo: "/images/universities/maple.png",
      description: "A Canadian institution with strong postgraduate and research programmes.",
      currency: "CAD",
      contactEmail: "admissions@maple.example",
    },
    {
      id: "seed-uni-southern-pacific",
      name: "Southern Pacific Institute",
      country: "Australia",
      city: "Sydney",
      website: "https://example.edu/southernpacific",
      logo: "/images/universities/southernpacific.png",
      description: "An Australian institute offering industry-linked practical education.",
      currency: "AUD",
      contactEmail: "admissions@southernpacific.example",
    },
  ] as const;

  const seededUniversities = new Map<string, { id: string; currency: string }>();
  for (const uni of universitySeeds) {
    const saved = await prisma.university.upsert({
      where: { id: uni.id },
      update: {
        name: uni.name,
        country: uni.country,
        city: uni.city,
        website: uni.website,
        logo: uni.logo,
        description: uni.description,
        currency: uni.currency,
        isActive: true,
        contactEmail: uni.contactEmail,
      },
      create: {
        id: uni.id,
        name: uni.name,
        country: uni.country,
        city: uni.city,
        website: uni.website,
        logo: uni.logo,
        description: uni.description,
        currency: uni.currency,
        isActive: true,
        contactEmail: uni.contactEmail,
      },
      select: { id: true },
    });

    seededUniversities.set(uni.name, { id: saved.id, currency: uni.currency });
  }

  const courseSeeds = [
    {
      id: "seed-course-bsc-computer-science",
      universityName: "University of Northbridge",
      name: "BSc Computer Science",
      level: "BACHELORS",
      duration: "3 years",
      fieldOfStudy: "Computer Science",
      tuitionFee: 16500,
      applicationFee: 75,
    },
    {
      id: "seed-course-msc-data-analytics",
      universityName: "University of Northbridge",
      name: "MSc Data Analytics",
      level: "MASTERS",
      duration: "12 months",
      fieldOfStudy: "Data Science",
      tuitionFee: 18250,
      applicationFee: 90,
    },
    {
      id: "seed-course-diploma-business-management",
      universityName: "Maple International University",
      name: "Diploma in Business Management",
      level: "DIPLOMA",
      duration: "2 years",
      fieldOfStudy: "Business",
      tuitionFee: 14500,
      applicationFee: 100,
    },
    {
      id: "seed-course-mba-global-leadership",
      universityName: "Maple International University",
      name: "MBA Global Leadership",
      level: "MASTERS",
      duration: "18 months",
      fieldOfStudy: "Management",
      tuitionFee: 23800,
      applicationFee: 120,
    },
    {
      id: "seed-course-foundation-engineering",
      universityName: "Southern Pacific Institute",
      name: "Foundation in Engineering",
      level: "FOUNDATION",
      duration: "9 months",
      fieldOfStudy: "Engineering",
      tuitionFee: 9800,
      applicationFee: 60,
    },
  ] as const;

  const seededCourses = new Map<string, { id: string; universityId: string }>();
  for (const courseSeed of courseSeeds) {
    const university = seededUniversities.get(courseSeed.universityName);
    if (!university) continue;

    const saved = await prisma.course.upsert({
      where: { id: courseSeed.id },
      update: {
        universityId: university.id,
        name: courseSeed.name,
        level: courseSeed.level,
        duration: courseSeed.duration,
        fieldOfStudy: courseSeed.fieldOfStudy,
        tuitionFee: courseSeed.tuitionFee,
        applicationFee: courseSeed.applicationFee,
        currency: university.currency,
        isActive: true,
      },
      create: {
        id: courseSeed.id,
        universityId: university.id,
        name: courseSeed.name,
        level: courseSeed.level,
        duration: courseSeed.duration,
        fieldOfStudy: courseSeed.fieldOfStudy,
        tuitionFee: courseSeed.tuitionFee,
        applicationFee: courseSeed.applicationFee,
        currency: university.currency,
        isActive: true,
      },
      select: { id: true },
    });

    seededCourses.set(courseSeed.name, { id: saved.id, universityId: university.id });
  }

  const scholarshipSeeds = [
    {
      id: "seed-scholarship-global-merit",
      name: "Global Merit Scholarship",
      universityName: "University of Northbridge",
      courseName: "BSc Computer Science",
      amount: 2500,
      currency: "GBP",
      amountType: "FIXED",
      eligibilityCriteria: "Minimum 75% previous academic score and strong statement of purpose.",
      nationalityRestrictions: ["BD", "IN", "NG"],
    },
    {
      id: "seed-scholarship-future-leaders",
      name: "Future Leaders Scholarship",
      universityName: "Maple International University",
      courseName: "MBA Global Leadership",
      amount: 20,
      currency: "CAD",
      amountType: "PERCENTAGE",
      percentageOf: "TUITION",
      eligibilityCriteria: "Leadership profile, interview, and minimum IELTS 6.5 equivalent.",
      nationalityRestrictions: ["BD", "IN", "PK", "NG"],
    },
  ] as const;

  for (const scholarship of scholarshipSeeds) {
    const uni = seededUniversities.get(scholarship.universityName);
    const course = seededCourses.get(scholarship.courseName);
    if (!uni) continue;

    await prisma.scholarship.upsert({
      where: { id: scholarship.id },
      update: {
        universityId: uni.id,
        courseId: course?.id ?? null,
        name: scholarship.name,
        amount: scholarship.amount,
        currency: scholarship.currency,
        amountType: scholarship.amountType,
        percentageOf: scholarship.amountType === "PERCENTAGE" ? scholarship.percentageOf : null,
        eligibilityCriteria: scholarship.eligibilityCriteria,
        nationalityRestrictions: [...scholarship.nationalityRestrictions],
        isActive: true,
      },
      create: {
        id: scholarship.id,
        universityId: uni.id,
        courseId: course?.id ?? null,
        name: scholarship.name,
        amount: scholarship.amount,
        currency: scholarship.currency,
        amountType: scholarship.amountType,
        percentageOf: scholarship.amountType === "PERCENTAGE" ? scholarship.percentageOf : null,
        eligibilityCriteria: scholarship.eligibilityCriteria,
        nationalityRestrictions: [...scholarship.nationalityRestrictions],
        isActive: true,
      },
    });
  }

  const adminUser = seededUsers.get("ADMIN");
  if (adminUser) {
    const financialRequirements = [
      {
        countryCode: "UK",
        countryName: "United Kingdom",
        monthlyLivingCost: 1334,
        currency: "GBP",
        defaultMonths: 9,
        rules: ["28-day consecutive bank statement rule"],
      },
      {
        countryCode: "CA",
        countryName: "Canada",
        monthlyLivingCost: 833,
        currency: "CAD",
        defaultMonths: 12,
        rules: ["3-month bank statement evidence required"],
      },
      {
        countryCode: "AU",
        countryName: "Australia",
        monthlyLivingCost: 1400,
        currency: "AUD",
        defaultMonths: 12,
        rules: ["Evidence should cover tuition and living costs"],
      },
      {
        countryCode: "US",
        countryName: "United States",
        monthlyLivingCost: 1500,
        currency: "USD",
        defaultMonths: 12,
        rules: ["I-20 financial declaration required"],
      },
    ] as const;

    for (const requirement of financialRequirements) {
      await prisma.activityLog.upsert({
        where: { id: `seed-financial-requirement-${requirement.countryCode.toLowerCase()}` },
        update: {
          userId: adminUser.id,
          entityType: "financialRequirementSettings",
          entityId: requirement.countryCode,
          action: "upsert",
          details: JSON.stringify(requirement),
        },
        create: {
          id: `seed-financial-requirement-${requirement.countryCode.toLowerCase()}`,
          userId: adminUser.id,
          entityType: "financialRequirementSettings",
          entityId: requirement.countryCode,
          action: "upsert",
          details: JSON.stringify(requirement),
        },
      });
    }
  }

  const firstCourse = await prisma.course.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (firstCourse) {
    const entryReq = await prisma.courseEntryRequirement.upsert({
      where: { courseId: firstCourse.id },
      update: {},
      create: {
        courseId: firstCourse.id,
        acceptedQualTypes: ["A_LEVEL", "SSC", "HSC", "FOUNDATION"],
        overallDescription: "Minimum requirements vary by country and programme level.",
        overallMinUniversal: 70,
        englishReqIelts: 6,
      },
      select: { id: true },
    });

    const seededCountryEntryRequirements: Array<{
      entryReqId: string;
      countryCode: string;
      programmeLevel: "UNDERGRADUATE" | "MASTERS";
      qualificationType:
        | "UK_ALEVEL"
        | "UK_GCSE"
        | "UK_BTEC"
        | "IB_DIPLOMA"
        | "BANGLADESH_SSC"
        | "BANGLADESH_HSC"
        | "INDIA_CLASS10"
        | "INDIA_CLASS12"
        | "PAKISTAN_MATRIC"
        | "PAKISTAN_FSCINTERMEDIATE"
        | "NIGERIA_WAEC"
        | "NIGERIA_JAMB"
        | "US_HIGHSCHOOL"
        | "US_AP"
        | "CANADA_HIGHSCHOOL"
        | "AUSTRALIA_YEAR12"
        | "MALAYSIA_STPM"
        | "SRI_LANKA_AL"
        | "NEPAL_SLC"
        | "OTHER";
      minGradeDescription: string;
      minUniversalScore: number;
      requiredSubjects?: Array<{
        subjectName: string;
        minimumGrade: string;
        isMandatory?: boolean;
      }>;
      minimumSubjectsRequired?: number;
      notes?: string;
      alternativePathwayAccepted?: boolean;
      alternativePathwayDetails?: string;
      ukviIeltsRequired?: boolean;
      noEnglishWaiver?: boolean;
    }> = [
      {
        entryReqId: entryReq.id,
        countryCode: "BD",
        programmeLevel: "UNDERGRADUATE",
        qualificationType: "BANGLADESH_HSC",
        minGradeDescription: "HSC minimum GPA 4.0 (80%) or above",
        minUniversalScore: 80,
        requiredSubjects: [
          { subjectName: "Mathematics", minimumGrade: "4.0", isMandatory: true },
          { subjectName: "English Language", minimumGrade: "4.0", isMandatory: true },
          { subjectName: "Physics", minimumGrade: "3.5", isMandatory: false },
          { subjectName: "Chemistry", minimumGrade: "3.5", isMandatory: false },
          { subjectName: "Biology", minimumGrade: "3.5", isMandatory: false },
        ],
        minimumSubjectsRequired: 5,
        alternativePathwayAccepted: true,
        alternativePathwayDetails: "Polytechnic Diploma with minimum 60% also accepted",
        ukviIeltsRequired: true,
        noEnglishWaiver: true,
      },
      {
        entryReqId: entryReq.id,
        countryCode: "BD",
        programmeLevel: "MASTERS",
        qualificationType: "BANGLADESH_HSC",
        minGradeDescription: "4-year Bachelor degree minimum 65% or GPA 2.5",
        minUniversalScore: 65,
        ukviIeltsRequired: true,
      },
      {
        entryReqId: entryReq.id,
        countryCode: "IN",
        programmeLevel: "UNDERGRADUATE",
        qualificationType: "INDIA_CLASS12",
        minGradeDescription: "Standard XII 75-85% depending on board",
        minUniversalScore: 75,
        alternativePathwayAccepted: true,
        alternativePathwayDetails: "Standard XII 60-80% eligible for International Foundation Year",
      },
      {
        entryReqId: entryReq.id,
        countryCode: "DEFAULT",
        programmeLevel: "UNDERGRADUATE",
        qualificationType: "UK_ALEVEL",
        minGradeDescription: "BBB at A-Level",
        minUniversalScore: 70,
        notes: "Check individual course requirements",
      },
    ];

    for (const requirement of seededCountryEntryRequirements) {
      const upserted = await prisma.countryEntryRequirement.upsert({
        where: {
          entryReqId_countryCode_programmeLevel: {
            entryReqId: requirement.entryReqId,
            countryCode: requirement.countryCode,
            programmeLevel: requirement.programmeLevel,
          },
        },
        update: {
          qualificationType: requirement.qualificationType,
          minGradeDescription: requirement.minGradeDescription,
          minUniversalScore: requirement.minUniversalScore,
          minimumSubjectsRequired: requirement.minimumSubjectsRequired,
          notes: requirement.notes,
          alternativePathwayAccepted: requirement.alternativePathwayAccepted,
          alternativePathwayDetails: requirement.alternativePathwayDetails,
          ukviIeltsRequired: requirement.ukviIeltsRequired,
          noEnglishWaiver: requirement.noEnglishWaiver,
        },
        create: {
          entryReqId: requirement.entryReqId,
          countryCode: requirement.countryCode,
          programmeLevel: requirement.programmeLevel,
          qualificationType: requirement.qualificationType,
          minGradeDescription: requirement.minGradeDescription,
          minUniversalScore: requirement.minUniversalScore,
          minimumSubjectsRequired: requirement.minimumSubjectsRequired,
          notes: requirement.notes,
          alternativePathwayAccepted: requirement.alternativePathwayAccepted,
          alternativePathwayDetails: requirement.alternativePathwayDetails,
          ukviIeltsRequired: requirement.ukviIeltsRequired,
          noEnglishWaiver: requirement.noEnglishWaiver,
        },
        select: { id: true },
      });

      await prisma.countrySubjectRequirement.deleteMany({
        where: { countryEntryRequirementId: upserted.id },
      });

      if (requirement.requiredSubjects?.length) {
        await prisma.countrySubjectRequirement.createMany({
          data: requirement.requiredSubjects.map((subject) => ({
            countryEntryRequirementId: upserted.id,
            subjectName: subject.subjectName,
            minimumGrade: subject.minimumGrade,
            isMandatory: subject.isMandatory ?? true,
          })),
        });
      }
    }

    console.log("Seeded example country-specific entry requirements for first course.");
  }

  // Seed default payment methods
  const providerSeeds = [
    {
      name: "Unite Students",
      type: "ACCOMMODATION" as const,
      country: "United Kingdom",
      city: "London",
      commissionRate: 10,
      isActive: true,
      commissionProtected: true,
    },
    {
      name: "StudentCom",
      type: "ACCOMMODATION" as const,
      country: "United Kingdom",
      city: "London",
      commissionRate: 8,
      isActive: true,
      commissionProtected: true,
    },
    {
      name: "Gradcracker",
      type: "JOB_INTERNSHIP" as const,
      country: "United Kingdom",
      city: "London",
      commissionRate: 15,
      isActive: true,
      commissionProtected: true,
    },
    {
      name: "Bright Network",
      type: "JOB_INTERNSHIP" as const,
      country: "United Kingdom",
      city: "London",
      commissionRate: 12,
      isActive: true,
      commissionProtected: true,
    },
  ];

  const providerIdByName = new Map<string, string>();
  for (const provider of providerSeeds) {
    const existingProvider = await prisma.serviceProvider.findFirst({
      where: {
        name: provider.name,
        type: provider.type,
      },
      select: { id: true },
    });

    if (existingProvider) {
      providerIdByName.set(provider.name, existingProvider.id);
      continue;
    }

    const createdProvider = await prisma.serviceProvider.create({
      data: {
        name: provider.name,
        type: provider.type,
        country: provider.country,
        city: provider.city,
        commissionRate: provider.commissionRate,
        isActive: provider.isActive,
        commissionProtected: provider.commissionProtected,
      },
      select: { id: true },
    });

    providerIdByName.set(provider.name, createdProvider.id);
  }

  const listingSeeds = [
    {
      title: "Modern Studio in Central London",
      providerName: "Unite Students",
      type: "ACCOMMODATION" as const,
      city: "London",
      country: "United Kingdom",
      price: 1200,
      currency: "GBP",
      priceType: "per month",
      bedrooms: 0,
      bathrooms: 1,
      amenities: ["WiFi", "Kitchen", "Security"],
      isFullyFurnished: true,
      isBillsIncluded: false,
      isActive: true,
      isFeatured: true,
      images: [],
      eligibleNationalities: [],
      eligibleStudyLevels: [],
    },
    {
      title: "Shared Room Near University",
      providerName: "StudentCom",
      type: "ACCOMMODATION" as const,
      city: "London",
      country: "United Kingdom",
      price: 750,
      currency: "GBP",
      priceType: "per month",
      bedrooms: 1,
      bathrooms: 1,
      amenities: ["WiFi", "Kitchen", "Washing Machine"],
      isFullyFurnished: true,
      isBillsIncluded: true,
      isActive: true,
      isFeatured: false,
      images: [],
      eligibleNationalities: [],
      eligibleStudyLevels: [],
    },
    {
      title: "Graduate Software Engineer",
      providerName: "Gradcracker",
      type: "JOB_INTERNSHIP" as const,
      city: "London",
      country: "United Kingdom",
      salaryMin: 28000,
      salaryMax: 35000,
      hoursPerWeek: 40,
      jobType: "Full Time",
      jobSector: "Technology",
      isRemote: false,
      isActive: true,
      isFeatured: true,
      amenities: [],
      images: [],
      eligibleNationalities: [],
      eligibleStudyLevels: [],
    },
    {
      title: "Finance Graduate Scheme",
      providerName: "Bright Network",
      type: "JOB_INTERNSHIP" as const,
      city: "London",
      country: "United Kingdom",
      salaryMin: 25000,
      salaryMax: 30000,
      hoursPerWeek: 37,
      jobType: "Graduate Scheme",
      jobSector: "Finance",
      isRemote: false,
      isActive: true,
      isFeatured: false,
      amenities: [],
      images: [],
      eligibleNationalities: [],
      eligibleStudyLevels: [],
    },
  ];

  for (const listing of listingSeeds) {
    const providerId = providerIdByName.get(listing.providerName);
    if (!providerId) continue;

    const existingListing = await prisma.serviceListing.findFirst({
      where: {
        providerId,
        title: listing.title,
      },
      select: { id: true },
    });

    if (existingListing) continue;

    await prisma.serviceListing.create({
      data: {
        providerId,
        type: listing.type,
        title: listing.title,
        city: listing.city,
        country: listing.country,
        price: "price" in listing ? listing.price : null,
        currency: "currency" in listing ? listing.currency : "GBP",
        priceType: "priceType" in listing ? listing.priceType : null,
        bedrooms: "bedrooms" in listing ? listing.bedrooms : null,
        bathrooms: "bathrooms" in listing ? listing.bathrooms : null,
        amenities: listing.amenities,
        images: listing.images,
        isFullyFurnished: "isFullyFurnished" in listing ? listing.isFullyFurnished : false,
        isBillsIncluded: "isBillsIncluded" in listing ? listing.isBillsIncluded : false,
        jobType: "jobType" in listing ? listing.jobType : null,
        jobSector: "jobSector" in listing ? listing.jobSector : null,
        salaryMin: "salaryMin" in listing ? listing.salaryMin : null,
        salaryMax: "salaryMax" in listing ? listing.salaryMax : null,
        hoursPerWeek: "hoursPerWeek" in listing ? listing.hoursPerWeek : null,
        isRemote: "isRemote" in listing ? listing.isRemote : false,
        eligibleNationalities: listing.eligibleNationalities,
        eligibleStudyLevels: listing.eligibleStudyLevels,
        isActive: listing.isActive,
        isFeatured: listing.isFeatured,
      },
    });
  }

  const pricingSeeds = [
    { name: "Airport Pickup Heathrow", airport: "Heathrow", amount: 50, currency: "GBP" },
    { name: "Airport Pickup Gatwick", airport: "Gatwick", amount: 55, currency: "GBP" },
    { name: "Airport Pickup Manchester", airport: "Manchester", amount: 65, currency: "GBP" },
    { name: "Airport Pickup Birmingham", airport: "Birmingham", amount: 60, currency: "GBP" },
    { name: "Airport Pickup Edinburgh", airport: "Edinburgh", amount: 75, currency: "GBP" },
    { name: "Airport Pickup Toronto Pearson", airport: "Toronto Pearson", amount: 80, currency: "CAD" },
    { name: "Airport Pickup Vancouver", airport: "Vancouver", amount: 85, currency: "CAD" },
    { name: "Airport Pickup Sydney", airport: "Sydney", amount: 90, currency: "AUD" },
    { name: "Airport Pickup Melbourne", airport: "Melbourne", amount: 95, currency: "AUD" },
  ];

  for (const pricing of pricingSeeds) {
    const existingPricing = await prisma.servicePricing.findFirst({
      where: {
        serviceType: "AIRPORT_PICKUP",
        OR: [
          { airport: { equals: pricing.airport, mode: "insensitive" } },
          { name: { equals: pricing.name, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });

    if (existingPricing) continue;

    await prisma.servicePricing.create({
      data: {
        serviceType: "AIRPORT_PICKUP",
        name: pricing.name,
        airport: pricing.airport,
        amount: pricing.amount,
        currency: pricing.currency,
        isActive: true,
      },
    });
  }
  console.log("Seeded service providers, listings, and airport pickup pricing.");

  const defaultPaymentMethods = [
    { name: "Bank Transfer", type: "BANK" },
    { name: "Cash", type: "CASH" },
    { name: "Google Pay", type: "DIGITAL_WALLET" },
    { name: "Apple Pay", type: "DIGITAL_WALLET" },
    { name: "Bkash", type: "E_BANKING" },
    { name: "Nagad", type: "E_BANKING" },
    { name: "AliPay", type: "DIGITAL_WALLET" },
    { name: "PayPal", type: "DIGITAL_WALLET" },
  ];

  for (const method of defaultPaymentMethods) {
    await prisma.paymentMethod.upsert({
      where: { name: method.name },
      update: {},
      create: {
        name: method.name,
        type: method.type,
        isActive: true,
      },
    });
  }
  console.log("Seeded default payment methods.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
