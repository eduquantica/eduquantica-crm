-- CreateTable
CREATE TABLE "SubAgentBusinessRegistration" (
    "id" TEXT NOT NULL,
    "subAgentId" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "submittedAt" TIMESTAMP(3),
    "legalBusinessName" TEXT,
    "businessRegistrationNumber" TEXT,
    "certificateIssuingAuthority" TEXT,
    "yearFounded" INTEGER,
    "legalStructure" TEXT,
    "legalStructureOther" TEXT,
    "businessCertificateUrl" TEXT,
    "certifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "certificationsOther" TEXT,
    "britishCouncilCertificateUrl" TEXT,
    "britishCouncilCertificateNumber" TEXT,
    "ownerFirstName" TEXT,
    "ownerLastName" TEXT,
    "coOwners" TEXT,
    "ownerIdDocumentUrl" TEXT,
    "addressStreet" TEXT,
    "addressCity" TEXT,
    "addressState" TEXT,
    "addressCountry" TEXT,
    "addressPostalCode" TEXT,
    "hasPhysicalOffice" BOOLEAN,
    "headOfficeSameAsBusiness" BOOLEAN,
    "headOfficeAddress" TEXT,
    "hasAdditionalOffices" BOOLEAN,
    "additionalOfficesDetails" TEXT,
    "staffCount" TEXT,
    "isFranchise" BOOLEAN,
    "franchiseName" TEXT,
    "servicesOffered" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "servicesOther" TEXT,
    "feeModel" TEXT,
    "sourceCountries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "destinationCountries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "programTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "programTypesOther" TEXT,
    "leadSources" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hasRecruitmentExperience" BOOLEAN,
    "yearsOfExperience" TEXT,
    "studentsPlacedLast12Months" TEXT,
    "expectedEnrolments" TEXT,
    "visaApprovalRate" TEXT,
    "worksWithAggregators" BOOLEAN,
    "aggregatorsList" TEXT,
    "subAgentsManaged" TEXT,
    "subAgentManagementProcess" TEXT,
    "hasOnlinePresence" BOOLEAN,
    "websiteUrl" TEXT,
    "linkedinUrl" TEXT,
    "facebookUrl" TEXT,
    "instagramUrl" TEXT,
    "tiktokUrl" TEXT,
    "consentAccepted" BOOLEAN NOT NULL DEFAULT false,
    "consentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubAgentBusinessRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubAgentBusinessRegistration_subAgentId_key" ON "SubAgentBusinessRegistration"("subAgentId");

-- CreateIndex
CREATE INDEX "SubAgentBusinessRegistration_submittedAt_idx" ON "SubAgentBusinessRegistration"("submittedAt");

-- AddForeignKey
ALTER TABLE "SubAgentBusinessRegistration" ADD CONSTRAINT "SubAgentBusinessRegistration_subAgentId_fkey" FOREIGN KEY ("subAgentId") REFERENCES "SubAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

