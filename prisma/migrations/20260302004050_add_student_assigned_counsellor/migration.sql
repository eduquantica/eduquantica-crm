-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "assignedCounsellorId" TEXT;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_assignedCounsellorId_fkey" FOREIGN KEY ("assignedCounsellorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
