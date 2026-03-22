-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "subAgentStaffId" TEXT;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "subAgentStaffId" TEXT;

-- CreateTable
CREATE TABLE "SubAgentStaff" (
    "id" TEXT NOT NULL,
    "subAgentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "role" TEXT NOT NULL DEFAULT 'BRANCH_COUNSELLOR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "studentsCount" INTEGER NOT NULL DEFAULT 0,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubAgentStaff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubAgentStaff_userId_key" ON "SubAgentStaff"("userId");

-- CreateIndex
CREATE INDEX "SubAgentStaff_subAgentId_idx" ON "SubAgentStaff"("subAgentId");

-- CreateIndex
CREATE INDEX "SubAgentStaff_isActive_idx" ON "SubAgentStaff"("isActive");

-- CreateIndex
CREATE INDEX "Application_subAgentStaffId_idx" ON "Application"("subAgentStaffId");

-- CreateIndex
CREATE INDEX "Student_subAgentStaffId_idx" ON "Student"("subAgentStaffId");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_subAgentStaffId_fkey" FOREIGN KEY ("subAgentStaffId") REFERENCES "SubAgentStaff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_subAgentStaffId_fkey" FOREIGN KEY ("subAgentStaffId") REFERENCES "SubAgentStaff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubAgentStaff" ADD CONSTRAINT "SubAgentStaff_subAgentId_fkey" FOREIGN KEY ("subAgentId") REFERENCES "SubAgent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubAgentStaff" ADD CONSTRAINT "SubAgentStaff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
