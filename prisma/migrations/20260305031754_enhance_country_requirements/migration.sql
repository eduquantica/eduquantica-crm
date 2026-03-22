-- CreateEnum
CREATE TYPE "ProgrammeLevel" AS ENUM ('IFP', 'FOUNDATION', 'UNDERGRADUATE', 'MASTERS', 'MBA', 'PHD', 'ALL');

-- CreateTable
CREATE TABLE "CountryEntryRequirement" (
    "id" TEXT NOT NULL,
    "entryReqId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "programmeLevel" "ProgrammeLevel" NOT NULL DEFAULT 'ALL',
    "qualificationType" TEXT NOT NULL,
    "minGradeDescription" TEXT NOT NULL,
    "minUniversalScore" DOUBLE PRECISION,
    "requiredSubjects" TEXT,
    "minimumSubjectCount" INTEGER,
    "alternativePathwayAccepted" BOOLEAN NOT NULL DEFAULT false,
    "alternativePathwayDetails" TEXT,
    "contextualOfferAvailable" BOOLEAN NOT NULL DEFAULT false,
    "contextualOfferDetails" TEXT,
    "englishSubjectOverride" BOOLEAN NOT NULL DEFAULT false,
    "englishOverrideSubjects" TEXT,
    "englishOverrideIELTS" DECIMAL(4,2),
    "ukviIeltsRequired" BOOLEAN NOT NULL DEFAULT false,
    "noEnglishWaiver" BOOLEAN NOT NULL DEFAULT false,
    "transferStudentAccepted" BOOLEAN NOT NULL DEFAULT false,
    "transferStudentDetails" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CountryEntryRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CountryEntryRequirement_entryReqId_idx" ON "CountryEntryRequirement"("entryReqId");

-- CreateIndex
CREATE INDEX "CountryEntryRequirement_countryCode_idx" ON "CountryEntryRequirement"("countryCode");

-- CreateIndex
CREATE INDEX "CountryEntryRequirement_programmeLevel_idx" ON "CountryEntryRequirement"("programmeLevel");

-- CreateIndex
CREATE UNIQUE INDEX "CountryEntryRequirement_entryReqId_countryCode_programmeLev_key" ON "CountryEntryRequirement"("entryReqId", "countryCode", "programmeLevel");

-- AddForeignKey
ALTER TABLE "CountryEntryRequirement" ADD CONSTRAINT "CountryEntryRequirement_entryReqId_fkey" FOREIGN KEY ("entryReqId") REFERENCES "CourseEntryRequirement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
