-- CreateEnum
CREATE TYPE "PreCasStage" AS ENUM ('BEFORE_OFFER', 'AFTER_CONDITIONAL_OFFER', 'DURING_CAS_ISSUE');

-- CreateEnum
CREATE TYPE "InterviewOutcome" AS ENUM ('PASSED', 'FAILED', 'RESCHEDULED', 'CANCELLED_BY_UNIVERSITY', 'NO_SHOW');

-- CreateTable
CREATE TABLE "PreCasInterview" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "stage" "PreCasStage",
    "bookedDate" TIMESTAMP(3),
    "outcome" "InterviewOutcome",
    "outcomeDate" TIMESTAMP(3),
    "outcomeNotes" TEXT,
    "rescheduledDate" TIMESTAMP(3),
    "cancelledReason" TEXT,
    "markedRequiredBy" TEXT,
    "markedRequiredAt" TIMESTAMP(3),
    "dateBookedBy" TEXT,
    "dateBookedAt" TIMESTAMP(3),
    "outcomeRecordedBy" TEXT,
    "outcomeRecordedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreCasInterview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisaInterview" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "bookedDate" TIMESTAMP(3),
    "location" TEXT,
    "outcome" "InterviewOutcome",
    "outcomeDate" TIMESTAMP(3),
    "outcomeNotes" TEXT,
    "rescheduledDate" TIMESTAMP(3),
    "cancelledReason" TEXT,
    "markedRequiredBy" TEXT,
    "markedRequiredAt" TIMESTAMP(3),
    "dateBookedBy" TEXT,
    "dateBookedAt" TIMESTAMP(3),
    "outcomeRecordedBy" TEXT,
    "outcomeRecordedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisaInterview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PreCasInterview_applicationId_key" ON "PreCasInterview"("applicationId");

-- CreateIndex
CREATE INDEX "PreCasInterview_isRequired_idx" ON "PreCasInterview"("isRequired");

-- CreateIndex
CREATE INDEX "PreCasInterview_bookedDate_idx" ON "PreCasInterview"("bookedDate");

-- CreateIndex
CREATE INDEX "PreCasInterview_outcome_idx" ON "PreCasInterview"("outcome");

-- CreateIndex
CREATE UNIQUE INDEX "VisaInterview_applicationId_key" ON "VisaInterview"("applicationId");

-- CreateIndex
CREATE INDEX "VisaInterview_isRequired_idx" ON "VisaInterview"("isRequired");

-- CreateIndex
CREATE INDEX "VisaInterview_bookedDate_idx" ON "VisaInterview"("bookedDate");

-- CreateIndex
CREATE INDEX "VisaInterview_outcome_idx" ON "VisaInterview"("outcome");

-- AddForeignKey
ALTER TABLE "PreCasInterview" ADD CONSTRAINT "PreCasInterview_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisaInterview" ADD CONSTRAINT "VisaInterview_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
