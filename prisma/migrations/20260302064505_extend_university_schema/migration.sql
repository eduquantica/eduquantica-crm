/*
  Warnings:

  - You are about to drop the column `ranking` on the `University` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "UniversityType" AS ENUM ('PUBLIC', 'PRIVATE');

-- AlterTable
ALTER TABLE "University" DROP COLUMN "ranking",
ADD COLUMN     "applicationFee" DOUBLE PRECISION,
ADD COLUMN     "campusPhotos" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "description" TEXT,
ADD COLUMN     "dliNumber" TEXT,
ADD COLUMN     "foundedYear" INTEGER,
ADD COLUMN     "postStudyWorkVisa" TEXT,
ADD COLUMN     "qsRanking" INTEGER,
ADD COLUMN     "timesHigherRanking" INTEGER,
ADD COLUMN     "type" "UniversityType" DEFAULT 'PUBLIC';

-- CreateIndex
CREATE INDEX "University_type_idx" ON "University"("type");
