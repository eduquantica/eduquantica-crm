-- Create enums
CREATE TYPE "ImmigrationMonitorStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ERROR');
CREATE TYPE "ImmigrationAlertStatus" AS ENUM ('PENDING_REVIEW', 'CONFIRMED_PUBLISHED', 'DISMISSED');

-- Create tables
CREATE TABLE "ImmigrationMonitoredPage" (
  "id" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "pageUrl" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "status" "ImmigrationMonitorStatus" NOT NULL DEFAULT 'ACTIVE',
  "lastCheckedAt" TIMESTAMP(3),
  "lastChangedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ImmigrationMonitoredPage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImmigrationPageSnapshot" (
  "id" TEXT NOT NULL,
  "monitoredPageId" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "keyContent" TEXT NOT NULL,
  "rawContent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ImmigrationPageSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImmigrationRuleAlert" (
  "id" TEXT NOT NULL,
  "monitoredPageId" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "pageUrl" TEXT NOT NULL,
  "oldContent" TEXT NOT NULL,
  "newContent" TEXT NOT NULL,
  "oldMonthlyLivingCost" DOUBLE PRECISION,
  "newMonthlyLivingCost" DOUBLE PRECISION,
  "currency" TEXT,
  "diffSummary" TEXT,
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" "ImmigrationAlertStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "confirmedByUserId" TEXT,
  "confirmedAt" TIMESTAMP(3),
  "settingsUpdatedAt" TIMESTAMP(3),
  "notificationPublishedAt" TIMESTAMP(3),
  CONSTRAINT "ImmigrationRuleAlert_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImmigrationRuleChangelog" (
  "id" TEXT NOT NULL,
  "alertId" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "oldMonthlyLivingCost" DOUBLE PRECISION,
  "newMonthlyLivingCost" DOUBLE PRECISION,
  "currency" TEXT,
  "summary" TEXT NOT NULL,
  "confirmedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ImmigrationRuleChangelog_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "ImmigrationMonitoredPage_pageUrl_key" ON "ImmigrationMonitoredPage"("pageUrl");
CREATE INDEX "ImmigrationMonitoredPage_country_idx" ON "ImmigrationMonitoredPage"("country");
CREATE INDEX "ImmigrationMonitoredPage_isActive_idx" ON "ImmigrationMonitoredPage"("isActive");
CREATE INDEX "ImmigrationMonitoredPage_status_idx" ON "ImmigrationMonitoredPage"("status");
CREATE INDEX "ImmigrationMonitoredPage_lastCheckedAt_idx" ON "ImmigrationMonitoredPage"("lastCheckedAt");

CREATE INDEX "ImmigrationPageSnapshot_monitoredPageId_createdAt_idx" ON "ImmigrationPageSnapshot"("monitoredPageId", "createdAt");

CREATE INDEX "ImmigrationRuleAlert_monitoredPageId_idx" ON "ImmigrationRuleAlert"("monitoredPageId");
CREATE INDEX "ImmigrationRuleAlert_country_idx" ON "ImmigrationRuleAlert"("country");
CREATE INDEX "ImmigrationRuleAlert_status_idx" ON "ImmigrationRuleAlert"("status");
CREATE INDEX "ImmigrationRuleAlert_detectedAt_idx" ON "ImmigrationRuleAlert"("detectedAt");

CREATE UNIQUE INDEX "ImmigrationRuleChangelog_alertId_key" ON "ImmigrationRuleChangelog"("alertId");
CREATE INDEX "ImmigrationRuleChangelog_country_idx" ON "ImmigrationRuleChangelog"("country");
CREATE INDEX "ImmigrationRuleChangelog_createdAt_idx" ON "ImmigrationRuleChangelog"("createdAt");

-- FKs
ALTER TABLE "ImmigrationPageSnapshot"
  ADD CONSTRAINT "ImmigrationPageSnapshot_monitoredPageId_fkey"
  FOREIGN KEY ("monitoredPageId") REFERENCES "ImmigrationMonitoredPage"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ImmigrationRuleAlert"
  ADD CONSTRAINT "ImmigrationRuleAlert_monitoredPageId_fkey"
  FOREIGN KEY ("monitoredPageId") REFERENCES "ImmigrationMonitoredPage"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ImmigrationRuleAlert"
  ADD CONSTRAINT "ImmigrationRuleAlert_confirmedByUserId_fkey"
  FOREIGN KEY ("confirmedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ImmigrationRuleChangelog"
  ADD CONSTRAINT "ImmigrationRuleChangelog_alertId_fkey"
  FOREIGN KEY ("alertId") REFERENCES "ImmigrationRuleAlert"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ImmigrationRuleChangelog"
  ADD CONSTRAINT "ImmigrationRuleChangelog_confirmedByUserId_fkey"
  FOREIGN KEY ("confirmedByUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed default monitored pages
INSERT INTO "ImmigrationMonitoredPage" ("id", "country", "pageUrl", "isActive", "status", "createdAt", "updatedAt")
VALUES
  ('imm-page-uk-financial-evidence', 'UK', 'https://www.gov.uk/guidance/financial-evidence-for-student-and-child-student-route', true, 'ACTIVE', NOW(), NOW()),
  ('imm-page-uk-student-visa', 'UK', 'https://www.gov.uk/student-visa', true, 'ACTIVE', NOW(), NOW()),
  ('imm-page-ca-study-canada', 'CA', 'https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada.html', true, 'ACTIVE', NOW(), NOW()),
  ('imm-page-au-student-500', 'AU', 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500', true, 'ACTIVE', NOW(), NOW()),
  ('imm-page-us-student-visa', 'US', 'https://travel.state.gov/content/travel/en/us-visas/study/student-visa.html', true, 'ACTIVE', NOW(), NOW())
ON CONFLICT ("pageUrl") DO NOTHING;
