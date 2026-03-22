-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "recentlyViewedCourses" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "StudentWishlist" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentWishlist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentWishlist_studentId_idx" ON "StudentWishlist"("studentId");

-- CreateIndex
CREATE INDEX "StudentWishlist_courseId_idx" ON "StudentWishlist"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentWishlist_studentId_courseId_key" ON "StudentWishlist"("studentId", "courseId");

-- AddForeignKey
ALTER TABLE "StudentWishlist" ADD CONSTRAINT "StudentWishlist_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentWishlist" ADD CONSTRAINT "StudentWishlist_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
