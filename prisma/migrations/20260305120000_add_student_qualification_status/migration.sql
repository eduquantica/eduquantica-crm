-- CreateEnum
CREATE TYPE "QualificationStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "StudentQualification"
ADD COLUMN "status" "QualificationStatus" NOT NULL DEFAULT 'COMPLETED';
