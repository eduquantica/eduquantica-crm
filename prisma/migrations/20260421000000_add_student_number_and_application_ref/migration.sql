-- AlterTable: add studentNumber to Student
ALTER TABLE "Student" ADD COLUMN "studentNumber" INTEGER;

-- AlterTable: add applicationRef to Application
ALTER TABLE "Application" ADD COLUMN "applicationRef" TEXT;

-- CreateIndex: unique studentNumber
CREATE UNIQUE INDEX "Student_studentNumber_key" ON "Student"("studentNumber");

-- CreateIndex: unique applicationRef
CREATE UNIQUE INDEX "Application_applicationRef_key" ON "Application"("applicationRef");
