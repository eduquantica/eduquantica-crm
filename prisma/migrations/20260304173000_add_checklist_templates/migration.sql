-- Checklist templates for destination-country/course-level driven checklist generation

CREATE TABLE IF NOT EXISTS "ChecklistTemplate" (
  "id" TEXT NOT NULL,
  "countryCode" TEXT NOT NULL,
  "countryName" TEXT NOT NULL,
  "courseLevel" "CourseLevel",
  "title" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ChecklistTemplateItem" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "documentType" "DocumentType" NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isRequired" BOOLEAN NOT NULL DEFAULT true,
  "isConditional" BOOLEAN NOT NULL DEFAULT false,
  "conditionRule" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChecklistTemplateItem_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DocumentChecklist"
  ADD COLUMN IF NOT EXISTS "templateId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DocumentChecklist_templateId_fkey'
  ) THEN
    ALTER TABLE "DocumentChecklist"
      ADD CONSTRAINT "DocumentChecklist_templateId_fkey"
      FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ChecklistTemplateItem_templateId_fkey'
  ) THEN
    ALTER TABLE "ChecklistTemplateItem"
      ADD CONSTRAINT "ChecklistTemplateItem_templateId_fkey"
      FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "ChecklistTemplate_countryCode_courseLevel_key"
  ON "ChecklistTemplate"("countryCode", "courseLevel");

CREATE INDEX IF NOT EXISTS "ChecklistTemplate_countryCode_idx"
  ON "ChecklistTemplate"("countryCode");

CREATE INDEX IF NOT EXISTS "ChecklistTemplate_isActive_idx"
  ON "ChecklistTemplate"("isActive");

CREATE UNIQUE INDEX IF NOT EXISTS "ChecklistTemplateItem_templateId_order_key"
  ON "ChecklistTemplateItem"("templateId", "order");

CREATE INDEX IF NOT EXISTS "ChecklistTemplateItem_templateId_idx"
  ON "ChecklistTemplateItem"("templateId");

CREATE INDEX IF NOT EXISTS "DocumentChecklist_templateId_idx"
  ON "DocumentChecklist"("templateId");
