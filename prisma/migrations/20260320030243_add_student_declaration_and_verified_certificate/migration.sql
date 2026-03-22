-- CreateTable
CREATE TABLE "StudentDeclaration" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "applicationId" TEXT,
    "declarationText" TEXT NOT NULL,
    "signatureName" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentDeclaration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerifiedCertificate" (
    "id" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "publicToken" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "studentEmail" TEXT NOT NULL,
    "universityName" TEXT NOT NULL,
    "courseName" TEXT NOT NULL,
    "destinationCountry" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerifiedCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentDeclaration_studentId_idx" ON "StudentDeclaration"("studentId");

-- CreateIndex
CREATE INDEX "StudentDeclaration_applicationId_idx" ON "StudentDeclaration"("applicationId");

-- CreateIndex
CREATE INDEX "StudentDeclaration_signedAt_idx" ON "StudentDeclaration"("signedAt");

-- CreateIndex
CREATE UNIQUE INDEX "VerifiedCertificate_checklistId_key" ON "VerifiedCertificate"("checklistId");

-- CreateIndex
CREATE UNIQUE INDEX "VerifiedCertificate_reference_key" ON "VerifiedCertificate"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "VerifiedCertificate_publicToken_key" ON "VerifiedCertificate"("publicToken");

-- CreateIndex
CREATE INDEX "VerifiedCertificate_publicToken_idx" ON "VerifiedCertificate"("publicToken");

-- CreateIndex
CREATE INDEX "VerifiedCertificate_reference_idx" ON "VerifiedCertificate"("reference");

-- AddForeignKey
ALTER TABLE "StudentDeclaration" ADD CONSTRAINT "StudentDeclaration_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDeclaration" ADD CONSTRAINT "StudentDeclaration_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;
