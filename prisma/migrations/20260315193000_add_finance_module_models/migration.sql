-- CreateEnum
CREATE TYPE "FundingSourceType" AS ENUM ('SPONSORSHIP', 'UNIVERSITY_SCHOLARSHIP', 'EDUCATION_LOAN', 'PERSONAL_FUNDS', 'OTHER');

-- CreateEnum
CREATE TYPE "BankAccountType" AS ENUM ('STANDARD', 'TERM_DEPOSIT', 'SAVINGS', 'INVESTMENT', 'PENSION', 'OTHER');

-- CreateEnum
CREATE TYPE "BankAccountOwnerType" AS ENUM ('MY_OWN', 'SOMEONE_ELSE', 'JOINT');

-- CreateTable
CREATE TABLE "LivingCostCountry" (
    "id" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "countryName" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "monthlyLivingCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "defaultMonths" INTEGER NOT NULL DEFAULT 12,
    "rulesJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LivingCostCountry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LivingCostRegion" (
    "id" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "regionCode" TEXT,
    "regionName" TEXT NOT NULL,
    "currency" TEXT,
    "monthlyLivingCost" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LivingCostRegion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceRecord" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "selectedSources" "FundingSourceType"[],
    "courseFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "courseFeeCurrency" TEXT NOT NULL DEFAULT 'GBP',
    "scholarshipFinal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "depositPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remainingTuition" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "livingExpenses" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "durationMonths" INTEGER NOT NULL DEFAULT 12,
    "totalToShowInBank" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherExplanation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundingSource" (
    "id" TEXT NOT NULL,
    "financeRecordId" TEXT NOT NULL,
    "sourceType" "FundingSourceType" NOT NULL,
    "declaredAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "detailsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FundingSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "financeRecordId" TEXT NOT NULL,
    "accountType" "BankAccountType" NOT NULL,
    "accountOwner" "BankAccountOwnerType" NOT NULL,
    "country" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "customBankName" TEXT,
    "accountCurrency" TEXT NOT NULL DEFAULT 'GBP',
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "allocatedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "accessibleImmediately" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LivingCostCountry_countryCode_key" ON "LivingCostCountry"("countryCode");

-- CreateIndex
CREATE INDEX "LivingCostCountry_countryCode_idx" ON "LivingCostCountry"("countryCode");

-- CreateIndex
CREATE INDEX "LivingCostCountry_countryName_idx" ON "LivingCostCountry"("countryName");

-- CreateIndex
CREATE INDEX "LivingCostRegion_countryId_idx" ON "LivingCostRegion"("countryId");

-- CreateIndex
CREATE INDEX "LivingCostRegion_regionName_idx" ON "LivingCostRegion"("regionName");

-- CreateIndex
CREATE UNIQUE INDEX "LivingCostRegion_countryId_regionName_key" ON "LivingCostRegion"("countryId", "regionName");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceRecord_applicationId_key" ON "FinanceRecord"("applicationId");

-- CreateIndex
CREATE INDEX "FinanceRecord_applicationId_idx" ON "FinanceRecord"("applicationId");

-- CreateIndex
CREATE INDEX "FundingSource_financeRecordId_idx" ON "FundingSource"("financeRecordId");

-- CreateIndex
CREATE INDEX "FundingSource_sourceType_idx" ON "FundingSource"("sourceType");

-- CreateIndex
CREATE INDEX "BankAccount_financeRecordId_idx" ON "BankAccount"("financeRecordId");

-- CreateIndex
CREATE INDEX "BankAccount_bankName_idx" ON "BankAccount"("bankName");

-- AddForeignKey
ALTER TABLE "LivingCostRegion" ADD CONSTRAINT "LivingCostRegion_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "LivingCostCountry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceRecord" ADD CONSTRAINT "FinanceRecord_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingSource" ADD CONSTRAINT "FundingSource_financeRecordId_fkey" FOREIGN KEY ("financeRecordId") REFERENCES "FinanceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_financeRecordId_fkey" FOREIGN KEY ("financeRecordId") REFERENCES "FinanceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
