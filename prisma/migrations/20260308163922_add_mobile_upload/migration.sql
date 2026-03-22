/*
  Warnings:

  - You are about to drop the column `direction` on the `MobileUploadSession` table. All the data in the column will be lost.
  - You are about to drop the column `fileUrl` on the `MobileUploadSession` table. All the data in the column will be lost.
  - You are about to drop the column `uploadSlotId` on the `MobileUploadSession` table. All the data in the column will be lost.
  - You are about to drop the column `uploadSlotType` on the `MobileUploadSession` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `MobileUploadSession` table. All the data in the column will be lost.
  - The `status` column on the `MobileUploadSession` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `checklistItemId` to the `MobileUploadSession` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdById` to the `MobileUploadSession` table without a default value. This is not possible if the table is not empty.
  - Added the required column `studentId` to the `MobileUploadSession` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "MobileUploadStatus" AS ENUM ('PENDING', 'UPLOADING', 'COMPLETED', 'EXPIRED');

-- DropForeignKey
ALTER TABLE "MobileUploadSession" DROP CONSTRAINT "MobileUploadSession_userId_fkey";

-- DropIndex
DROP INDEX "MobileUploadSession_uploadSlotId_idx";

-- DropIndex
DROP INDEX "MobileUploadSession_userId_idx";

-- AlterTable
ALTER TABLE "MobileUploadSession" DROP COLUMN "direction",
DROP COLUMN "fileUrl",
DROP COLUMN "uploadSlotId",
DROP COLUMN "uploadSlotType",
DROP COLUMN "userId",
ADD COLUMN     "checklistItemId" TEXT NOT NULL,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "createdById" TEXT NOT NULL,
ADD COLUMN     "studentId" TEXT NOT NULL,
ADD COLUMN     "uploadedFileName" TEXT,
ADD COLUMN     "uploadedFileUrl" TEXT,
DROP COLUMN "status",
ADD COLUMN     "status" "MobileUploadStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "MobileUploadSession_checklistItemId_idx" ON "MobileUploadSession"("checklistItemId");

-- CreateIndex
CREATE INDEX "MobileUploadSession_studentId_idx" ON "MobileUploadSession"("studentId");

-- CreateIndex
CREATE INDEX "MobileUploadSession_createdById_idx" ON "MobileUploadSession"("createdById");

-- CreateIndex
CREATE INDEX "MobileUploadSession_status_idx" ON "MobileUploadSession"("status");

-- AddForeignKey
ALTER TABLE "MobileUploadSession" ADD CONSTRAINT "MobileUploadSession_checklistItemId_fkey" FOREIGN KEY ("checklistItemId") REFERENCES "ChecklistItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileUploadSession" ADD CONSTRAINT "MobileUploadSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileUploadSession" ADD CONSTRAINT "MobileUploadSession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
