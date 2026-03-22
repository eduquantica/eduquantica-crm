-- CreateTable
CREATE TABLE "EligibilityOverride" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "overriddenById" TEXT,
    "overriddenByName" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EligibilityOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EligibilityOverride_studentId_idx" ON "EligibilityOverride"("studentId");

-- CreateIndex
CREATE INDEX "EligibilityOverride_courseId_idx" ON "EligibilityOverride"("courseId");

-- CreateIndex
CREATE INDEX "EligibilityOverride_createdAt_idx" ON "EligibilityOverride"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EligibilityOverride_studentId_courseId_key" ON "EligibilityOverride"("studentId", "courseId");

-- AddForeignKey
ALTER TABLE "EligibilityOverride" ADD CONSTRAINT "EligibilityOverride_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EligibilityOverride" ADD CONSTRAINT "EligibilityOverride_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
