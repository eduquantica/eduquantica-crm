-- CreateEnum
CREATE TYPE "FeeConfigType" AS ENUM ('UCAS_SINGLE', 'UCAS_MULTIPLE', 'UNIVERSITY_DIRECT');

-- CreateEnum
CREATE TYPE "FeePaymentStatus" AS ENUM ('PENDING', 'PAID', 'WAIVED', 'REFUNDED');

-- CreateTable
CREATE TABLE "ApplicationFeeConfig" (
    "id" TEXT NOT NULL,
    "configType" "FeeConfigType" NOT NULL,
    "universityId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "academicYear" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationFeeConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationFeePayment" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT,
    "studentId" TEXT NOT NULL,
    "ucasGroupId" TEXT,
    "feeType" "FeeConfigType" NOT NULL,
    "universityId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "status" "FeePaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidBy" TEXT,
    "paidByRole" TEXT,
    "paymentMethod" TEXT,
    "paymentRef" TEXT,
    "receiptUrl" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationFeePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApplicationFeeConfig_configType_effectiveFrom_idx" ON "ApplicationFeeConfig"("configType", "effectiveFrom");

-- CreateIndex
CREATE INDEX "ApplicationFeeConfig_universityId_idx" ON "ApplicationFeeConfig"("universityId");

-- CreateIndex
CREATE INDEX "ApplicationFeePayment_applicationId_idx" ON "ApplicationFeePayment"("applicationId");

-- CreateIndex
CREATE INDEX "ApplicationFeePayment_studentId_createdAt_idx" ON "ApplicationFeePayment"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "ApplicationFeePayment_status_idx" ON "ApplicationFeePayment"("status");

-- CreateIndex
CREATE INDEX "ApplicationFeePayment_ucasGroupId_idx" ON "ApplicationFeePayment"("ucasGroupId");

-- CreateIndex
CREATE INDEX "ApplicationFeePayment_feeType_idx" ON "ApplicationFeePayment"("feeType");

-- AddForeignKey
ALTER TABLE "ApplicationFeeConfig" ADD CONSTRAINT "ApplicationFeeConfig_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationFeePayment" ADD CONSTRAINT "ApplicationFeePayment_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationFeePayment" ADD CONSTRAINT "ApplicationFeePayment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationFeePayment" ADD CONSTRAINT "ApplicationFeePayment_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE SET NULL ON UPDATE CASCADE;
