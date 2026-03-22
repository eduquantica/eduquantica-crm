/*
  Warnings:

  - You are about to drop the column `testCentre` on the `StudentTestScore` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "StudentTestScore"
DROP COLUMN "testCentre",
ADD COLUMN "certificateFileName" TEXT,
ADD COLUMN "isUKVI" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
