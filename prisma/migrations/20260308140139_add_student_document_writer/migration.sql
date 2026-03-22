-- CreateEnum
CREATE TYPE "WrittenDocumentType" AS ENUM ('SOP', 'PERSONAL_STATEMENT');

-- CreateEnum
CREATE TYPE "WrittenDocumentStatus" AS ENUM ('DRAFT', 'GRAMMAR_CHECKED', 'SUBMITTED_FOR_SCAN', 'SCAN_COMPLETE', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "StudentDocument" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "applicationId" TEXT,
    "documentType" "WrittenDocumentType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "WrittenDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "grammarScore" DOUBLE PRECISION,
    "grammarCheckedAt" TIMESTAMP(3),
    "plagiarismScore" DOUBLE PRECISION,
    "aiContentScore" DOUBLE PRECISION,
    "scanStatus" TEXT,
    "scanReportUrl" TEXT,
    "scanCheckedAt" TIMESTAMP(3),
    "convertedPdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentDocumentVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "savedBy" TEXT NOT NULL,

    CONSTRAINT "StudentDocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentDocument_studentId_idx" ON "StudentDocument"("studentId");

-- CreateIndex
CREATE INDEX "StudentDocument_applicationId_idx" ON "StudentDocument"("applicationId");

-- CreateIndex
CREATE INDEX "StudentDocument_documentType_idx" ON "StudentDocument"("documentType");

-- CreateIndex
CREATE INDEX "StudentDocument_status_idx" ON "StudentDocument"("status");

-- CreateIndex
CREATE INDEX "StudentDocumentVersion_documentId_idx" ON "StudentDocumentVersion"("documentId");

-- CreateIndex
CREATE INDEX "StudentDocumentVersion_savedAt_idx" ON "StudentDocumentVersion"("savedAt");

-- AddForeignKey
ALTER TABLE "StudentDocument" ADD CONSTRAINT "StudentDocument_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDocument" ADD CONSTRAINT "StudentDocument_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDocumentVersion" ADD CONSTRAINT "StudentDocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "StudentDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
