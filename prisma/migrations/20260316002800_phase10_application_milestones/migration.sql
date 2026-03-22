-- CreateEnum
CREATE TYPE "ApplicationMilestone" AS ENUM ('APPLICATION_SUBMISSION', 'OFFER_LETTER', 'FINANCE', 'CAS', 'VISA');

-- CreateEnum
CREATE TYPE "ApplicationMilestoneStatus" AS ENUM ('MISSING', 'UPLOADED', 'VERIFIED', 'REJECTED');

-- CreateTable
CREATE TABLE "ApplicationMilestoneDocument" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "milestone" "ApplicationMilestone" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "status" "ApplicationMilestoneStatus" NOT NULL DEFAULT 'MISSING',
    "fileName" TEXT,
    "fileUrl" TEXT,
    "uploadedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationMilestoneDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApplicationMilestoneDocument_applicationId_idx" ON "ApplicationMilestoneDocument"("applicationId");

-- CreateIndex
CREATE INDEX "ApplicationMilestoneDocument_milestone_idx" ON "ApplicationMilestoneDocument"("milestone");

-- CreateIndex
CREATE INDEX "ApplicationMilestoneDocument_status_idx" ON "ApplicationMilestoneDocument"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationMilestoneDocument_applicationId_milestone_key" ON "ApplicationMilestoneDocument"("applicationId", "milestone");

-- AddForeignKey
ALTER TABLE "ApplicationMilestoneDocument" ADD CONSTRAINT "ApplicationMilestoneDocument_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationMilestoneDocument" ADD CONSTRAINT "ApplicationMilestoneDocument_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
