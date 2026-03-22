/*
  Warnings:

  - You are about to drop the column `messages` on the `ChatSession` table. All the data in the column will be lost.
  - Added the required column `sessionType` to the `ChatSession` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `ChatSession` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ChatSessionType" AS ENUM ('PUBLIC_VISITOR', 'LOGGED_IN_STUDENT', 'LOGGED_IN_STAFF');

-- CreateEnum
CREATE TYPE "ChatStatus" AS ENUM ('ACTIVE', 'ENDED', 'LEAD_CAPTURED', 'HANDED_OFF');

-- CreateEnum
CREATE TYPE "ChatRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- DropForeignKey
ALTER TABLE "ChatSession" DROP CONSTRAINT "ChatSession_userId_fkey";

-- AlterTable
ALTER TABLE "ChatSession" DROP COLUMN "messages",
ADD COLUMN     "endedAt" TIMESTAMP(3),
ADD COLUMN     "leadCaptured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "leadId" TEXT,
ADD COLUMN     "sessionType" "ChatSessionType" NOT NULL,
ADD COLUMN     "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "status" "ChatStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "studentId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "visitorId" TEXT,
ALTER COLUMN "userId" DROP NOT NULL,
ALTER COLUMN "language" SET DEFAULT 'en';

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" "ChatRole" NOT NULL,
    "content" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "isVoice" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EduviKnowledgeBase" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tags" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EduviKnowledgeBase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatMessage_sessionId_idx" ON "ChatMessage"("sessionId");

-- CreateIndex
CREATE INDEX "ChatMessage_createdAt_idx" ON "ChatMessage"("createdAt");

-- CreateIndex
CREATE INDEX "EduviKnowledgeBase_category_idx" ON "EduviKnowledgeBase"("category");

-- CreateIndex
CREATE INDEX "EduviKnowledgeBase_isActive_idx" ON "EduviKnowledgeBase"("isActive");

-- CreateIndex
CREATE INDEX "EduviKnowledgeBase_createdBy_idx" ON "EduviKnowledgeBase"("createdBy");

-- CreateIndex
CREATE INDEX "ChatSession_sessionType_idx" ON "ChatSession"("sessionType");

-- CreateIndex
CREATE INDEX "ChatSession_studentId_idx" ON "ChatSession"("studentId");

-- CreateIndex
CREATE INDEX "ChatSession_visitorId_idx" ON "ChatSession"("visitorId");

-- CreateIndex
CREATE INDEX "ChatSession_status_idx" ON "ChatSession"("status");

-- CreateIndex
CREATE INDEX "ChatSession_startedAt_idx" ON "ChatSession"("startedAt");

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
