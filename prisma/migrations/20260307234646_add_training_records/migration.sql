-- CreateEnum
CREATE TYPE "TrainingRecordStatus" AS ENUM ('ACTIVE', 'EXPIRING_SOON', 'EXPIRED', 'RENEWED');

-- CreateTable
CREATE TABLE "Training" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "organisationType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "deliveredBy" TEXT,
    "trainingDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurringMonths" INTEGER,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Training_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingRecord" (
    "id" TEXT NOT NULL,
    "trainingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "completionDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "certificateUrl" TEXT,
    "notes" TEXT,
    "status" "TrainingRecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Training_organisationId_idx" ON "Training"("organisationId");

-- CreateIndex
CREATE INDEX "Training_organisationType_idx" ON "Training"("organisationType");

-- CreateIndex
CREATE INDEX "Training_trainingDate_idx" ON "Training"("trainingDate");

-- CreateIndex
CREATE INDEX "Training_expiryDate_idx" ON "Training"("expiryDate");

-- CreateIndex
CREATE INDEX "TrainingRecord_trainingId_idx" ON "TrainingRecord"("trainingId");

-- CreateIndex
CREATE INDEX "TrainingRecord_userId_idx" ON "TrainingRecord"("userId");

-- CreateIndex
CREATE INDEX "TrainingRecord_expiryDate_idx" ON "TrainingRecord"("expiryDate");

-- CreateIndex
CREATE INDEX "TrainingRecord_status_idx" ON "TrainingRecord"("status");

-- AddForeignKey
ALTER TABLE "TrainingRecord" ADD CONSTRAINT "TrainingRecord_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "Training"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRecord" ADD CONSTRAINT "TrainingRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
