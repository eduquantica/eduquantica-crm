-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'COUNSELLOR', 'SUB_AGENT', 'STUDENT');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('FACEBOOK', 'INSTAGRAM', 'WHATSAPP', 'GOOGLE_ADS', 'WEBSITE', 'REFERRAL', 'WALK_IN');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST');

-- CreateEnum
CREATE TYPE "CourseLevel" AS ENUM ('FOUNDATION', 'BACHELORS', 'MASTERS', 'PHD', 'DIPLOMA');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('DRAFT', 'DOCUMENTS_PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'CONDITIONAL_OFFER', 'UNCONDITIONAL_OFFER', 'CAS_ISSUED', 'VISA_APPLIED', 'VISA_APPROVED', 'VISA_REJECTED', 'ENROLLED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('PASSPORT', 'TRANSCRIPT', 'DEGREE_CERT', 'ENGLISH_TEST', 'SOP', 'LOR', 'CV', 'FINANCIAL_PROOF', 'PHOTO', 'VISA_DOCUMENT', 'PERSONAL_STATEMENT', 'COVER_LETTER', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "FlagColour" AS ENUM ('GREEN', 'AMBER', 'RED');

-- CreateEnum
CREATE TYPE "CommunicationType" AS ENUM ('EMAIL', 'SMS', 'WHATSAPP', 'CALL', 'NOTE');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "VisaStatus" AS ENUM ('PREPARING', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AgentTier" AS ENUM ('STANDARD', 'SILVER', 'PLATINUM');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('PENDING_ARRIVAL', 'CALCULATED', 'INVOICED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'PAID', 'REJECTED');

-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('PENDING', 'SCANNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "CounsellorDecision" AS ENUM ('ACCEPTED', 'REVISION_REQUIRED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ChecklistStatus" AS ENUM ('IN_PROGRESS', 'PENDING_REVIEW', 'UNDER_REVIEW', 'REVISION_NEEDED', 'VERIFIED', 'SIGNED');

-- CreateEnum
CREATE TYPE "FraudRisk" AS ENUM ('UNKNOWN', 'LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('PENDING', 'UPLOADED', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "QualType" AS ENUM ('GCSE', 'A_LEVEL', 'O_LEVEL', 'SSC', 'HSC', 'WAEC', 'NECO', 'IB', 'FOUNDATION', 'BTEC', 'OTHER');

-- CreateEnum
CREATE TYPE "SubjectCategory" AS ENUM ('STEM', 'LANGUAGE', 'HUMANITIES', 'ARTS', 'BUSINESS', 'VOCATIONAL', 'OTHER');

-- CreateEnum
CREATE TYPE "SubjectReqType" AS ENUM ('REQUIRED', 'PREFERRED', 'EXCLUDED');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('FULL_MATCH', 'PARTIAL_MATCH', 'NO_MATCH');

-- CreateEnum
CREATE TYPE "ScholarshipAmountType" AS ENUM ('FIXED', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "PercentageOf" AS ENUM ('TUITION', 'LIVING', 'TOTAL');

-- CreateEnum
CREATE TYPE "ScholarshipAppStatus" AS ENUM ('INTERESTED', 'APPLIED', 'SHORTLISTED', 'AWARDED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "phone" TEXT,
    "avatar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "source" "LeadSource" NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "assignedCounsellorId" TEXT,
    "subAgentId" TEXT,
    "nationality" TEXT,
    "interestedCountry" TEXT,
    "interestedLevel" TEXT,
    "notes" TEXT,
    "campaign" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "nationality" TEXT,
    "passportNumber" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT,
    "highestQualification" TEXT,
    "grades" TEXT,
    "englishTestType" TEXT,
    "englishTestScore" TEXT,
    "workExperience" TEXT,
    "maritalStatus" TEXT,
    "emergencyContact" TEXT,
    "subAgentId" TEXT,
    "preferredCurrency" TEXT,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "University" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "city" TEXT,
    "website" TEXT,
    "logo" TEXT,
    "ranking" INTEGER,
    "partnerSince" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "contactPerson" TEXT,
    "contactEmail" TEXT,

    CONSTRAINT "University_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" "CourseLevel" NOT NULL,
    "subject" TEXT,
    "duration" TEXT,
    "tuitionFee" DOUBLE PRECISION,
    "currency" TEXT NOT NULL,
    "intakes" TEXT[],
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "counsellorId" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "offerReceivedAt" TIMESTAMP(3),
    "notes" TEXT,
    "priority" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "applicationId" TEXT,
    "type" "DocumentType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "flagColour" "FlagColour",
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Communication" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "studentId" TEXT,
    "userId" TEXT NOT NULL,
    "type" "CommunicationType" NOT NULL,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Communication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "studentId" TEXT,
    "leadId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisaApplication" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "appointmentDate" TIMESTAMP(3),
    "status" "VisaStatus" NOT NULL DEFAULT 'PREPARING',
    "submittedAt" TIMESTAMP(3),
    "decisionAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "VisaApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubAgent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agencyName" TEXT NOT NULL,
    "agencyCountry" TEXT,
    "agencyCity" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubAgentAgreement" (
    "id" TEXT NOT NULL,
    "subAgentId" TEXT NOT NULL,
    "currentTier" "AgentTier" NOT NULL DEFAULT 'STANDARD',
    "currentRate" DOUBLE PRECISION NOT NULL DEFAULT 80,
    "silverThreshold" INTEGER,
    "platinumThreshold" INTEGER,
    "intakePeriod" TEXT,
    "enrolmentsThisIntake" INTEGER NOT NULL DEFAULT 0,
    "manualTierOverride" BOOLEAN NOT NULL DEFAULT false,
    "overrideReason" TEXT,
    "overrideBy" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "agreedDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubAgentAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UniversityCommissionAgreement" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "commissionRate" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "agreedDate" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UniversityCommissionAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commission" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "universityAgreementId" TEXT NOT NULL,
    "tuitionFee" DOUBLE PRECISION NOT NULL,
    "universityCommRate" DOUBLE PRECISION NOT NULL,
    "grossCommission" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "subAgentId" TEXT,
    "agentTierAtTime" TEXT,
    "agentRateAtTime" DOUBLE PRECISION,
    "agentAmount" DOUBLE PRECISION,
    "eduquanticaNet" DOUBLE PRECISION,
    "status" "CommissionStatus" NOT NULL DEFAULT 'PENDING_ARRIVAL',
    "visaApprovedAt" TIMESTAMP(3),
    "enrolmentConfirmedAt" TIMESTAMP(3),
    "confirmedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Commission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubAgentInvoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "subAgentId" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "pdfUrl" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'SUBMITTED',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bankDetails" TEXT,
    "adminNote" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "paymentRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubAgentInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentScanResult" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "scanId" TEXT,
    "status" "ScanStatus" NOT NULL DEFAULT 'PENDING',
    "plagiarismScore" DOUBLE PRECISION,
    "aiScore" DOUBLE PRECISION,
    "reportUrl" TEXT,
    "flagColour" "FlagColour",
    "counsellorDecision" "CounsellorDecision",
    "counsellorNote" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "scannedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentScanResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanSettings" (
    "id" TEXT NOT NULL,
    "plagiarismAmberThreshold" DOUBLE PRECISION NOT NULL DEFAULT 16,
    "plagiarismRedThreshold" DOUBLE PRECISION NOT NULL DEFAULT 31,
    "aiAmberThreshold" DOUBLE PRECISION NOT NULL DEFAULT 21,
    "aiRedThreshold" DOUBLE PRECISION NOT NULL DEFAULT 41,
    "autoApproveGreen" BOOLEAN NOT NULL DEFAULT false,
    "autoAlertAdmin" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ScanSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurrencyRate" (
    "id" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL,
    "targetCurrency" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "source" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CurrencyRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentChecklist" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "destinationCountry" TEXT,
    "courseLevel" TEXT,
    "status" "ChecklistStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verificationRef" TEXT,
    "signedPdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "label" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "isConditional" BOOLEAN NOT NULL DEFAULT false,
    "conditionalNote" TEXT,
    "documentId" TEXT,
    "ocrStatus" TEXT,
    "ocrData" JSONB,
    "fraudRiskLevel" "FraudRisk" NOT NULL DEFAULT 'UNKNOWN',
    "fraudFlags" TEXT[],
    "ocrConfidence" DOUBLE PRECISION,
    "status" "ItemStatus" NOT NULL DEFAULT 'PENDING',
    "counsellorNote" TEXT,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentAcademicProfile" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentAcademicProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentQualification" (
    "id" TEXT NOT NULL,
    "academicProfileId" TEXT NOT NULL,
    "qualType" "QualType" NOT NULL,
    "qualName" TEXT NOT NULL,
    "yearCompleted" INTEGER,
    "institutionName" TEXT,
    "overallGrade" TEXT,
    "overallUniversal" DOUBLE PRECISION,
    "transcriptDocId" TEXT,
    "ocrConfirmedByStudent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentQualification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentSubjectGrade" (
    "id" TEXT NOT NULL,
    "qualificationId" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "subjectCategory" "SubjectCategory" NOT NULL,
    "rawGrade" TEXT,
    "universalScore" DOUBLE PRECISION,
    "ocrConfidence" DOUBLE PRECISION,
    "isOcrExtracted" BOOLEAN NOT NULL DEFAULT false,
    "isConfirmedByStudent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentSubjectGrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseEntryRequirement" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "acceptedQualTypes" "QualType"[],
    "overallMinUniversal" DOUBLE PRECISION,
    "overallDescription" TEXT,
    "englishReqIelts" DOUBLE PRECISION,
    "englishReqPte" DOUBLE PRECISION,
    "englishReqToefl" DOUBLE PRECISION,
    "additionalNotes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseEntryRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseSubjectRequirement" (
    "id" TEXT NOT NULL,
    "entryReqId" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "subjectAliases" TEXT[],
    "subjectCategory" "SubjectCategory",
    "minimumUniversal" DOUBLE PRECISION,
    "minimumDescription" TEXT,
    "requirementType" "SubjectReqType" NOT NULL DEFAULT 'REQUIRED',
    "isAlternativeGroup" BOOLEAN NOT NULL DEFAULT false,
    "alternativeGroupId" TEXT,

    CONSTRAINT "CourseSubjectRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseEligibilityResult" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "matchStatus" "MatchStatus" NOT NULL,
    "overallMet" BOOLEAN NOT NULL,
    "matchScore" DOUBLE PRECISION NOT NULL,
    "subjectResults" JSONB,
    "missingSubjects" TEXT[],
    "weakSubjects" TEXT[],
    "englishMet" BOOLEAN,
    "counsellorFlagNote" TEXT,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseEligibilityResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scholarship" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "courseId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "amountType" "ScholarshipAmountType" NOT NULL,
    "percentageOf" "PercentageOf",
    "isPartial" BOOLEAN NOT NULL DEFAULT false,
    "deadline" TIMESTAMP(3),
    "intakePeriod" TEXT,
    "eligibilityCriteria" TEXT NOT NULL,
    "nationalityRestrictions" TEXT[],
    "minAcademicScore" DOUBLE PRECISION,
    "minEnglishScore" DOUBLE PRECISION,
    "isAutoRenewable" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "applicationProcess" TEXT,
    "externalUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scholarship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentScholarshipApplication" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "scholarshipId" TEXT NOT NULL,
    "applicationId" TEXT,
    "status" "ScholarshipAppStatus" NOT NULL DEFAULT 'INTERESTED',
    "appliedAt" TIMESTAMP(3),
    "awardedAmount" DOUBLE PRECISION,
    "notes" TEXT,
    "counsellorNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentScholarshipApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "Lead_assignedCounsellorId_idx" ON "Lead"("assignedCounsellorId");

-- CreateIndex
CREATE INDEX "Lead_subAgentId_idx" ON "Lead"("subAgentId");

-- CreateIndex
CREATE INDEX "Lead_source_idx" ON "Lead"("source");

-- CreateIndex
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Student_userId_key" ON "Student"("userId");

-- CreateIndex
CREATE INDEX "Student_email_idx" ON "Student"("email");

-- CreateIndex
CREATE INDEX "Student_userId_idx" ON "Student"("userId");

-- CreateIndex
CREATE INDEX "Student_subAgentId_idx" ON "Student"("subAgentId");

-- CreateIndex
CREATE INDEX "Student_nationality_idx" ON "Student"("nationality");

-- CreateIndex
CREATE INDEX "University_country_idx" ON "University"("country");

-- CreateIndex
CREATE INDEX "University_isActive_idx" ON "University"("isActive");

-- CreateIndex
CREATE INDEX "Course_universityId_idx" ON "Course"("universityId");

-- CreateIndex
CREATE INDEX "Course_level_idx" ON "Course"("level");

-- CreateIndex
CREATE INDEX "Course_isActive_idx" ON "Course"("isActive");

-- CreateIndex
CREATE INDEX "Application_studentId_idx" ON "Application"("studentId");

-- CreateIndex
CREATE INDEX "Application_courseId_idx" ON "Application"("courseId");

-- CreateIndex
CREATE INDEX "Application_universityId_idx" ON "Application"("universityId");

-- CreateIndex
CREATE INDEX "Application_counsellorId_idx" ON "Application"("counsellorId");

-- CreateIndex
CREATE INDEX "Application_status_idx" ON "Application"("status");

-- CreateIndex
CREATE INDEX "Application_createdAt_idx" ON "Application"("createdAt");

-- CreateIndex
CREATE INDEX "Document_studentId_idx" ON "Document"("studentId");

-- CreateIndex
CREATE INDEX "Document_applicationId_idx" ON "Document"("applicationId");

-- CreateIndex
CREATE INDEX "Document_type_idx" ON "Document"("type");

-- CreateIndex
CREATE INDEX "Document_status_idx" ON "Document"("status");

-- CreateIndex
CREATE INDEX "Communication_leadId_idx" ON "Communication"("leadId");

-- CreateIndex
CREATE INDEX "Communication_studentId_idx" ON "Communication"("studentId");

-- CreateIndex
CREATE INDEX "Communication_userId_idx" ON "Communication"("userId");

-- CreateIndex
CREATE INDEX "Communication_createdAt_idx" ON "Communication"("createdAt");

-- CreateIndex
CREATE INDEX "Task_userId_idx" ON "Task"("userId");

-- CreateIndex
CREATE INDEX "Task_studentId_idx" ON "Task"("studentId");

-- CreateIndex
CREATE INDEX "Task_leadId_idx" ON "Task"("leadId");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- CreateIndex
CREATE INDEX "Task_dueDate_idx" ON "Task"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "VisaApplication_applicationId_key" ON "VisaApplication"("applicationId");

-- CreateIndex
CREATE INDEX "VisaApplication_studentId_idx" ON "VisaApplication"("studentId");

-- CreateIndex
CREATE INDEX "VisaApplication_status_idx" ON "VisaApplication"("status");

-- CreateIndex
CREATE INDEX "ActivityLog_userId_idx" ON "ActivityLog"("userId");

-- CreateIndex
CREATE INDEX "ActivityLog_entityType_entityId_idx" ON "ActivityLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SubAgent_userId_key" ON "SubAgent"("userId");

-- CreateIndex
CREATE INDEX "SubAgent_isApproved_idx" ON "SubAgent"("isApproved");

-- CreateIndex
CREATE INDEX "SubAgent_agencyCountry_idx" ON "SubAgent"("agencyCountry");

-- CreateIndex
CREATE UNIQUE INDEX "SubAgentAgreement_subAgentId_key" ON "SubAgentAgreement"("subAgentId");

-- CreateIndex
CREATE INDEX "SubAgentAgreement_currentTier_idx" ON "SubAgentAgreement"("currentTier");

-- CreateIndex
CREATE INDEX "SubAgentAgreement_isActive_idx" ON "SubAgentAgreement"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "UniversityCommissionAgreement_universityId_key" ON "UniversityCommissionAgreement"("universityId");

-- CreateIndex
CREATE INDEX "UniversityCommissionAgreement_isActive_idx" ON "UniversityCommissionAgreement"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Commission_applicationId_key" ON "Commission"("applicationId");

-- CreateIndex
CREATE INDEX "Commission_universityAgreementId_idx" ON "Commission"("universityAgreementId");

-- CreateIndex
CREATE INDEX "Commission_subAgentId_idx" ON "Commission"("subAgentId");

-- CreateIndex
CREATE INDEX "Commission_status_idx" ON "Commission"("status");

-- CreateIndex
CREATE INDEX "Commission_createdAt_idx" ON "Commission"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SubAgentInvoice_invoiceNumber_key" ON "SubAgentInvoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "SubAgentInvoice_subAgentId_idx" ON "SubAgentInvoice"("subAgentId");

-- CreateIndex
CREATE INDEX "SubAgentInvoice_status_idx" ON "SubAgentInvoice"("status");

-- CreateIndex
CREATE INDEX "SubAgentInvoice_invoiceNumber_idx" ON "SubAgentInvoice"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentScanResult_documentId_key" ON "DocumentScanResult"("documentId");

-- CreateIndex
CREATE INDEX "DocumentScanResult_status_idx" ON "DocumentScanResult"("status");

-- CreateIndex
CREATE INDEX "DocumentScanResult_flagColour_idx" ON "DocumentScanResult"("flagColour");

-- CreateIndex
CREATE INDEX "CurrencyRate_baseCurrency_idx" ON "CurrencyRate"("baseCurrency");

-- CreateIndex
CREATE INDEX "CurrencyRate_fetchedAt_idx" ON "CurrencyRate"("fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CurrencyRate_baseCurrency_targetCurrency_key" ON "CurrencyRate"("baseCurrency", "targetCurrency");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentChecklist_applicationId_key" ON "DocumentChecklist"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentChecklist_verificationRef_key" ON "DocumentChecklist"("verificationRef");

-- CreateIndex
CREATE INDEX "DocumentChecklist_studentId_idx" ON "DocumentChecklist"("studentId");

-- CreateIndex
CREATE INDEX "DocumentChecklist_status_idx" ON "DocumentChecklist"("status");

-- CreateIndex
CREATE INDEX "ChecklistItem_checklistId_idx" ON "ChecklistItem"("checklistId");

-- CreateIndex
CREATE INDEX "ChecklistItem_status_idx" ON "ChecklistItem"("status");

-- CreateIndex
CREATE INDEX "ChecklistItem_fraudRiskLevel_idx" ON "ChecklistItem"("fraudRiskLevel");

-- CreateIndex
CREATE UNIQUE INDEX "StudentAcademicProfile_studentId_key" ON "StudentAcademicProfile"("studentId");

-- CreateIndex
CREATE INDEX "StudentAcademicProfile_studentId_idx" ON "StudentAcademicProfile"("studentId");

-- CreateIndex
CREATE INDEX "StudentQualification_academicProfileId_idx" ON "StudentQualification"("academicProfileId");

-- CreateIndex
CREATE INDEX "StudentQualification_qualType_idx" ON "StudentQualification"("qualType");

-- CreateIndex
CREATE INDEX "StudentSubjectGrade_qualificationId_idx" ON "StudentSubjectGrade"("qualificationId");

-- CreateIndex
CREATE INDEX "StudentSubjectGrade_subjectCategory_idx" ON "StudentSubjectGrade"("subjectCategory");

-- CreateIndex
CREATE UNIQUE INDEX "CourseEntryRequirement_courseId_key" ON "CourseEntryRequirement"("courseId");

-- CreateIndex
CREATE INDEX "CourseEntryRequirement_courseId_idx" ON "CourseEntryRequirement"("courseId");

-- CreateIndex
CREATE INDEX "CourseSubjectRequirement_entryReqId_idx" ON "CourseSubjectRequirement"("entryReqId");

-- CreateIndex
CREATE INDEX "CourseSubjectRequirement_requirementType_idx" ON "CourseSubjectRequirement"("requirementType");

-- CreateIndex
CREATE INDEX "CourseEligibilityResult_studentId_idx" ON "CourseEligibilityResult"("studentId");

-- CreateIndex
CREATE INDEX "CourseEligibilityResult_courseId_idx" ON "CourseEligibilityResult"("courseId");

-- CreateIndex
CREATE INDEX "CourseEligibilityResult_matchStatus_idx" ON "CourseEligibilityResult"("matchStatus");

-- CreateIndex
CREATE UNIQUE INDEX "CourseEligibilityResult_studentId_courseId_key" ON "CourseEligibilityResult"("studentId", "courseId");

-- CreateIndex
CREATE INDEX "Scholarship_universityId_idx" ON "Scholarship"("universityId");

-- CreateIndex
CREATE INDEX "Scholarship_courseId_idx" ON "Scholarship"("courseId");

-- CreateIndex
CREATE INDEX "Scholarship_isActive_idx" ON "Scholarship"("isActive");

-- CreateIndex
CREATE INDEX "StudentScholarshipApplication_studentId_idx" ON "StudentScholarshipApplication"("studentId");

-- CreateIndex
CREATE INDEX "StudentScholarshipApplication_scholarshipId_idx" ON "StudentScholarshipApplication"("scholarshipId");

-- CreateIndex
CREATE INDEX "StudentScholarshipApplication_applicationId_idx" ON "StudentScholarshipApplication"("applicationId");

-- CreateIndex
CREATE INDEX "StudentScholarshipApplication_status_idx" ON "StudentScholarshipApplication"("status");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedCounsellorId_fkey" FOREIGN KEY ("assignedCounsellorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_subAgentId_fkey" FOREIGN KEY ("subAgentId") REFERENCES "SubAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_subAgentId_fkey" FOREIGN KEY ("subAgentId") REFERENCES "SubAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_counsellorId_fkey" FOREIGN KEY ("counsellorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisaApplication" ADD CONSTRAINT "VisaApplication_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisaApplication" ADD CONSTRAINT "VisaApplication_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubAgent" ADD CONSTRAINT "SubAgent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubAgentAgreement" ADD CONSTRAINT "SubAgentAgreement_subAgentId_fkey" FOREIGN KEY ("subAgentId") REFERENCES "SubAgent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UniversityCommissionAgreement" ADD CONSTRAINT "UniversityCommissionAgreement_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_universityAgreementId_fkey" FOREIGN KEY ("universityAgreementId") REFERENCES "UniversityCommissionAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_subAgentId_fkey" FOREIGN KEY ("subAgentId") REFERENCES "SubAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubAgentInvoice" ADD CONSTRAINT "SubAgentInvoice_subAgentId_fkey" FOREIGN KEY ("subAgentId") REFERENCES "SubAgent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentScanResult" ADD CONSTRAINT "DocumentScanResult_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentChecklist" ADD CONSTRAINT "DocumentChecklist_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentChecklist" ADD CONSTRAINT "DocumentChecklist_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "DocumentChecklist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAcademicProfile" ADD CONSTRAINT "StudentAcademicProfile_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentQualification" ADD CONSTRAINT "StudentQualification_academicProfileId_fkey" FOREIGN KEY ("academicProfileId") REFERENCES "StudentAcademicProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentQualification" ADD CONSTRAINT "StudentQualification_transcriptDocId_fkey" FOREIGN KEY ("transcriptDocId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSubjectGrade" ADD CONSTRAINT "StudentSubjectGrade_qualificationId_fkey" FOREIGN KEY ("qualificationId") REFERENCES "StudentQualification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseEntryRequirement" ADD CONSTRAINT "CourseEntryRequirement_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseSubjectRequirement" ADD CONSTRAINT "CourseSubjectRequirement_entryReqId_fkey" FOREIGN KEY ("entryReqId") REFERENCES "CourseEntryRequirement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseEligibilityResult" ADD CONSTRAINT "CourseEligibilityResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseEligibilityResult" ADD CONSTRAINT "CourseEligibilityResult_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scholarship" ADD CONSTRAINT "Scholarship_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scholarship" ADD CONSTRAINT "Scholarship_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentScholarshipApplication" ADD CONSTRAINT "StudentScholarshipApplication_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentScholarshipApplication" ADD CONSTRAINT "StudentScholarshipApplication_scholarshipId_fkey" FOREIGN KEY ("scholarshipId") REFERENCES "Scholarship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentScholarshipApplication" ADD CONSTRAINT "StudentScholarshipApplication_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;
