-- DropForeignKey
ALTER TABLE "MobileUploadSession" DROP CONSTRAINT "MobileUploadSession_checklistItemId_fkey";

-- AlterTable
ALTER TABLE "StudentSubjectGrade" ADD COLUMN     "gradeType" TEXT NOT NULL DEFAULT 'LETTER';

-- AddForeignKey
ALTER TABLE "MobileUploadSession" ADD CONSTRAINT "MobileUploadSession_checklistItemId_fkey" FOREIGN KEY ("checklistItemId") REFERENCES "ChecklistItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
