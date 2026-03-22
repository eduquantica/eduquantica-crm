-- AlterTable
ALTER TABLE "MobileUploadSession"
  ADD COLUMN "documentField" TEXT,
  ADD COLUMN "documentType" TEXT,
  ADD COLUMN "usedAt" TIMESTAMP(3),
  ALTER COLUMN "checklistItemId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "MobileUploadSession_documentField_idx" ON "MobileUploadSession"("documentField");
