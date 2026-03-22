-- CreateTable
CREATE TABLE "CvProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "studentId" TEXT,
    "fullName" TEXT,
    "professionalTitle" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT,
    "nationality" TEXT,
    "profilePhotoUrl" TEXT,
    "profileSummary" TEXT,
    "linkedinUrl" TEXT,
    "portfolioUrl" TEXT,
    "templateStyle" TEXT NOT NULL DEFAULT 'modern',
    "showReferences" BOOLEAN NOT NULL DEFAULT true,
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "lastGeneratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CvProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CvEducation" (
    "id" TEXT NOT NULL,
    "cvProfileId" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "qualification" TEXT NOT NULL,
    "fieldOfStudy" TEXT,
    "grade" TEXT,
    "startDate" TEXT,
    "endDate" TEXT,
    "isCurrently" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "country" TEXT,
    "autoImported" BOOLEAN NOT NULL DEFAULT false,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CvEducation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CvWorkExperience" (
    "id" TEXT NOT NULL,
    "cvProfileId" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "employer" TEXT NOT NULL,
    "location" TEXT,
    "startDate" TEXT,
    "endDate" TEXT,
    "isCurrently" BOOLEAN NOT NULL DEFAULT false,
    "responsibilities" TEXT,
    "achievements" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CvWorkExperience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CvSkill" (
    "id" TEXT NOT NULL,
    "cvProfileId" TEXT NOT NULL,
    "skillName" TEXT NOT NULL,
    "proficiency" TEXT,
    "category" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CvSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CvLanguage" (
    "id" TEXT NOT NULL,
    "cvProfileId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "proficiency" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CvLanguage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CvReference" (
    "id" TEXT NOT NULL,
    "cvProfileId" TEXT NOT NULL,
    "refereeName" TEXT NOT NULL,
    "jobTitle" TEXT,
    "organisation" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "relationship" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CvReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CvAchievement" (
    "id" TEXT NOT NULL,
    "cvProfileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "date" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CvAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CvProfile_userId_key" ON "CvProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CvProfile_studentId_key" ON "CvProfile"("studentId");

-- AddForeignKey
ALTER TABLE "CvProfile" ADD CONSTRAINT "CvProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CvProfile" ADD CONSTRAINT "CvProfile_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CvEducation" ADD CONSTRAINT "CvEducation_cvProfileId_fkey" FOREIGN KEY ("cvProfileId") REFERENCES "CvProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CvWorkExperience" ADD CONSTRAINT "CvWorkExperience_cvProfileId_fkey" FOREIGN KEY ("cvProfileId") REFERENCES "CvProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CvSkill" ADD CONSTRAINT "CvSkill_cvProfileId_fkey" FOREIGN KEY ("cvProfileId") REFERENCES "CvProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CvLanguage" ADD CONSTRAINT "CvLanguage_cvProfileId_fkey" FOREIGN KEY ("cvProfileId") REFERENCES "CvProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CvReference" ADD CONSTRAINT "CvReference_cvProfileId_fkey" FOREIGN KEY ("cvProfileId") REFERENCES "CvProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CvAchievement" ADD CONSTRAINT "CvAchievement_cvProfileId_fkey" FOREIGN KEY ("cvProfileId") REFERENCES "CvProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
