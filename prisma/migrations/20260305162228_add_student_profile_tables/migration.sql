-- CreateTable
CREATE TABLE "StudentTestScore" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "testType" TEXT NOT NULL,
    "dateTaken" TIMESTAMP(3),
    "testCentre" TEXT,
    "overallScore" TEXT,
    "listeningScore" TEXT,
    "readingScore" TEXT,
    "writingScore" TEXT,
    "speakingScore" TEXT,
    "certificateUrl" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentTestScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentVisaRefusal" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "visaType" TEXT NOT NULL,
    "refusalMonth" TEXT NOT NULL,
    "refusalYear" INTEGER NOT NULL,
    "reason" TEXT,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedExplanation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentVisaRefusal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentPreferences" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "preferredDestinations" JSONB NOT NULL,
    "preferredLevels" JSONB NOT NULL,
    "preferredFields" JSONB NOT NULL,
    "preferredIntake" TEXT,
    "maxBudget" DOUBLE PRECISION,
    "budgetCurrency" TEXT,
    "preferredCurrency" TEXT,
    "communicationLanguage" TEXT,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "smsNotifications" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentTestScore_studentId_idx" ON "StudentTestScore"("studentId");

-- CreateIndex
CREATE INDEX "StudentTestScore_testType_idx" ON "StudentTestScore"("testType");

-- CreateIndex
CREATE INDEX "StudentTestScore_createdAt_idx" ON "StudentTestScore"("createdAt");

-- CreateIndex
CREATE INDEX "StudentVisaRefusal_studentId_idx" ON "StudentVisaRefusal"("studentId");

-- CreateIndex
CREATE INDEX "StudentVisaRefusal_country_idx" ON "StudentVisaRefusal"("country");

-- CreateIndex
CREATE INDEX "StudentVisaRefusal_refusalYear_idx" ON "StudentVisaRefusal"("refusalYear");

-- CreateIndex
CREATE UNIQUE INDEX "StudentPreferences_studentId_key" ON "StudentPreferences"("studentId");

-- CreateIndex
CREATE INDEX "StudentPreferences_studentId_idx" ON "StudentPreferences"("studentId");

-- AddForeignKey
ALTER TABLE "StudentTestScore" ADD CONSTRAINT "StudentTestScore_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentVisaRefusal" ADD CONSTRAINT "StudentVisaRefusal_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPreferences" ADD CONSTRAINT "StudentPreferences_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
