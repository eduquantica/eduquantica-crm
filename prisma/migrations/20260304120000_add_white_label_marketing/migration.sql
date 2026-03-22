-- CreateEnum
CREATE TYPE "MarketingMaterialType" AS ENUM (
  'BROCHURE_PDF',
  'SOCIAL_MEDIA_POST',
  'EMAIL_TEMPLATE',
  'UNIVERSITY_FLYER',
  'BANNER_AD',
  'PRESENTATION'
);

-- AlterTable SubAgent
ALTER TABLE "SubAgent"
  ADD COLUMN IF NOT EXISTS "referralCode" TEXT,
  ADD COLUMN IF NOT EXISTS "brandingLogoUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "brandingPrimaryColor" TEXT DEFAULT '#1E3A5F',
  ADD COLUMN IF NOT EXISTS "brandingContactEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "brandingContactPhone" TEXT,
  ADD COLUMN IF NOT EXISTS "brandingWebsite" TEXT,
  ADD COLUMN IF NOT EXISTS "brandingFacebook" TEXT,
  ADD COLUMN IF NOT EXISTS "brandingInstagram" TEXT,
  ADD COLUMN IF NOT EXISTS "brandingLinkedIn" TEXT,
  ADD COLUMN IF NOT EXISTS "brandingWhatsapp" TEXT;

-- AlterTable Student
ALTER TABLE "Student"
  ADD COLUMN IF NOT EXISTS "referredBySubAgentId" TEXT;

-- CreateTable MarketingMaterial
CREATE TABLE IF NOT EXISTS "MarketingMaterial" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "MarketingMaterialType" NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "thumbnailUrl" TEXT,
  "availableTiers" TEXT[] DEFAULT ARRAY['GOLD','SILVER','PLATINUM']::TEXT[],
  "linkedUniversityId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT,
  "subAgentOwnerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketingMaterial_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "SubAgent_referralCode_key" ON "SubAgent"("referralCode");
CREATE INDEX IF NOT EXISTS "Student_referredBySubAgentId_idx" ON "Student"("referredBySubAgentId");
CREATE INDEX IF NOT EXISTS "MarketingMaterial_type_idx" ON "MarketingMaterial"("type");
CREATE INDEX IF NOT EXISTS "MarketingMaterial_isActive_idx" ON "MarketingMaterial"("isActive");
CREATE INDEX IF NOT EXISTS "MarketingMaterial_linkedUniversityId_idx" ON "MarketingMaterial"("linkedUniversityId");
CREATE INDEX IF NOT EXISTS "MarketingMaterial_subAgentOwnerId_idx" ON "MarketingMaterial"("subAgentOwnerId");

-- Foreign keys
ALTER TABLE "Student"
  ADD CONSTRAINT "Student_referredBySubAgentId_fkey"
  FOREIGN KEY ("referredBySubAgentId") REFERENCES "SubAgent"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MarketingMaterial"
  ADD CONSTRAINT "MarketingMaterial_linkedUniversityId_fkey"
  FOREIGN KEY ("linkedUniversityId") REFERENCES "University"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MarketingMaterial"
  ADD CONSTRAINT "MarketingMaterial_subAgentOwnerId_fkey"
  FOREIGN KEY ("subAgentOwnerId") REFERENCES "SubAgent"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
