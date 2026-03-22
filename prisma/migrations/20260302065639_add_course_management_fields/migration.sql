/*
  Warnings:

  - You are about to drop the column `intakes` on the `Course` table. All the data in the column will be lost.
  - You are about to drop the column `subject` on the `Course` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `Course` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "StudyMode" AS ENUM ('FULL_TIME', 'PART_TIME', 'ONLINE');

-- CreateEnum
CREATE TYPE "CourseTag" AS ENUM ('FAST_ACCEPTANCE', 'INSTANT_OFFER', 'POPULAR', 'HIGH_JOB_DEMAND', 'TOP', 'PRIME', 'NO_VISA_CAP', 'LOANS_AVAILABLE');

-- AlterEnum
ALTER TYPE "CourseLevel" ADD VALUE 'CERTIFICATE';

-- AlterTable
ALTER TABLE "Course" DROP COLUMN "intakes",
DROP COLUMN "subject",
ADD COLUMN     "applicationFee" DOUBLE PRECISION,
ADD COLUMN     "completionRate" DOUBLE PRECISION,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "curriculum" TEXT,
ADD COLUMN     "fieldOfStudy" TEXT,
ADD COLUMN     "intakeDatesWithDeadlines" JSONB,
ADD COLUMN     "studyMode" "StudyMode" NOT NULL DEFAULT 'FULL_TIME',
ADD COLUMN     "tags" "CourseTag"[],
ADD COLUMN     "totalEnrolledStudents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "Course_fieldOfStudy_idx" ON "Course"("fieldOfStudy");

-- CreateIndex
CREATE INDEX "Course_createdAt_idx" ON "Course"("createdAt");
