-- CreateEnum
CREATE TYPE "SubAgentTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM');

-- AlterTable
ALTER TABLE "SubAgent" ADD COLUMN     "certificateIssuedAt" TIMESTAMP(3),
ADD COLUMN     "certificateUrl" TEXT,
ADD COLUMN     "tier" "SubAgentTier" NOT NULL DEFAULT 'BRONZE',
ADD COLUMN     "tierAchievedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SubAgentTierCertificate" (
    "id" TEXT NOT NULL,
    "subAgentId" TEXT NOT NULL,
    "tier" "SubAgentTier" NOT NULL,
    "certificateNumber" TEXT NOT NULL,
    "certificateUrl" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "achievementPct" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubAgentTierCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubAgentTierCertificate_certificateNumber_key" ON "SubAgentTierCertificate"("certificateNumber");

-- CreateIndex
CREATE INDEX "SubAgentTierCertificate_subAgentId_idx" ON "SubAgentTierCertificate"("subAgentId");

-- CreateIndex
CREATE INDEX "SubAgentTierCertificate_tier_idx" ON "SubAgentTierCertificate"("tier");

-- CreateIndex
CREATE INDEX "SubAgentTierCertificate_issuedAt_idx" ON "SubAgentTierCertificate"("issuedAt");

-- CreateIndex
CREATE INDEX "SubAgent_tier_idx" ON "SubAgent"("tier");

-- AddForeignKey
ALTER TABLE "SubAgentTierCertificate" ADD CONSTRAINT "SubAgentTierCertificate_subAgentId_fkey" FOREIGN KEY ("subAgentId") REFERENCES "SubAgent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
