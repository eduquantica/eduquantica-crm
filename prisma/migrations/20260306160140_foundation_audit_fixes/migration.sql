-- AlterEnum
ALTER TYPE "LeadSource" ADD VALUE 'CHATBOT';

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "isUcas" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ucasGroupId" TEXT,
ADD COLUMN     "ucasGroupPaymentStatus" TEXT;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "chatTranscript" JSONB;

-- AlterTable
ALTER TABLE "SubAgentAgreement" ADD COLUMN     "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 80;

-- CreateTable
CREATE TABLE "WishlistItem" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WishlistItem_studentId_idx" ON "WishlistItem"("studentId");

-- CreateIndex
CREATE INDEX "WishlistItem_courseId_idx" ON "WishlistItem"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "WishlistItem_studentId_courseId_key" ON "WishlistItem"("studentId", "courseId");

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
