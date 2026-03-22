-- CreateEnum
CREATE TYPE "KpiPeriod" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUALLY', 'INTAKE_SEASON');

-- CreateTable
CREATE TABLE "KpiTarget" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "organisationType" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "period" "KpiPeriod" NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "targetLeadsContacted" INTEGER NOT NULL DEFAULT 0,
    "targetLeadToStudent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "targetStudentToOffer" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "targetOfferToDeposit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "targetDepositToVisa" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "targetVisaToEnrolled" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "targetOverallConversion" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "targetEnrollments" INTEGER NOT NULL DEFAULT 0,
    "setByAdminDefault" BOOLEAN NOT NULL DEFAULT false,
    "overriddenByManager" BOOLEAN NOT NULL DEFAULT false,
    "overriddenByManagerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KpiTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KpiResult" (
    "id" TEXT NOT NULL,
    "kpiTargetId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "period" "KpiPeriod" NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "actualLeadsContacted" INTEGER NOT NULL DEFAULT 0,
    "actualLeadsConverted" INTEGER NOT NULL DEFAULT 0,
    "actualStudentsWithOffer" INTEGER NOT NULL DEFAULT 0,
    "actualDepositPaid" INTEGER NOT NULL DEFAULT 0,
    "actualVisaApplied" INTEGER NOT NULL DEFAULT 0,
    "actualEnrolled" INTEGER NOT NULL DEFAULT 0,
    "leadContactRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "leadToStudentRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "studentToOfferRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "offerToDepositRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "depositToVisaRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "visaToEnrolledRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overallConversionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "achievementPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KpiResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadAllocation" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "allocatedToId" TEXT NOT NULL,
    "allocatedById" TEXT NOT NULL,
    "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "LeadAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KpiTarget_organisationId_idx" ON "KpiTarget"("organisationId");

-- CreateIndex
CREATE INDEX "KpiTarget_organisationType_idx" ON "KpiTarget"("organisationType");

-- CreateIndex
CREATE INDEX "KpiTarget_staffId_idx" ON "KpiTarget"("staffId");

-- CreateIndex
CREATE INDEX "KpiTarget_period_idx" ON "KpiTarget"("period");

-- CreateIndex
CREATE INDEX "KpiTarget_startDate_idx" ON "KpiTarget"("startDate");

-- CreateIndex
CREATE INDEX "KpiTarget_endDate_idx" ON "KpiTarget"("endDate");

-- CreateIndex
CREATE INDEX "KpiTarget_setByAdminDefault_idx" ON "KpiTarget"("setByAdminDefault");

-- CreateIndex
CREATE INDEX "KpiResult_kpiTargetId_idx" ON "KpiResult"("kpiTargetId");

-- CreateIndex
CREATE INDEX "KpiResult_staffId_idx" ON "KpiResult"("staffId");

-- CreateIndex
CREATE INDEX "KpiResult_period_idx" ON "KpiResult"("period");

-- CreateIndex
CREATE INDEX "KpiResult_startDate_idx" ON "KpiResult"("startDate");

-- CreateIndex
CREATE INDEX "KpiResult_endDate_idx" ON "KpiResult"("endDate");

-- CreateIndex
CREATE INDEX "KpiResult_calculatedAt_idx" ON "KpiResult"("calculatedAt");

-- CreateIndex
CREATE INDEX "LeadAllocation_leadId_idx" ON "LeadAllocation"("leadId");

-- CreateIndex
CREATE INDEX "LeadAllocation_allocatedToId_idx" ON "LeadAllocation"("allocatedToId");

-- CreateIndex
CREATE INDEX "LeadAllocation_allocatedById_idx" ON "LeadAllocation"("allocatedById");

-- CreateIndex
CREATE INDEX "LeadAllocation_allocatedAt_idx" ON "LeadAllocation"("allocatedAt");

-- CreateIndex
CREATE INDEX "LeadAllocation_isActive_idx" ON "LeadAllocation"("isActive");

-- AddForeignKey
ALTER TABLE "KpiTarget" ADD CONSTRAINT "KpiTarget_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiResult" ADD CONSTRAINT "KpiResult_kpiTargetId_fkey" FOREIGN KEY ("kpiTargetId") REFERENCES "KpiTarget"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiResult" ADD CONSTRAINT "KpiResult_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadAllocation" ADD CONSTRAINT "LeadAllocation_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadAllocation" ADD CONSTRAINT "LeadAllocation_allocatedToId_fkey" FOREIGN KEY ("allocatedToId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadAllocation" ADD CONSTRAINT "LeadAllocation_allocatedById_fkey" FOREIGN KEY ("allocatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
