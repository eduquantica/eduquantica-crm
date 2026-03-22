-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "intake" TEXT;

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "intakes" TEXT[] DEFAULT ARRAY[]::TEXT[];
