-- Website scholarship search filters. openDate, amountMax, studyLevels and fieldsOfStudy
-- already exist in production (added directly by the scholarship uploader), so every
-- step is IF NOT EXISTS: safe on production and on a fresh database.

ALTER TYPE "ProgrammeLevel" ADD VALUE IF NOT EXISTS 'MRES';
ALTER TYPE "ProgrammeLevel" ADD VALUE IF NOT EXISTS 'MPHIL';
ALTER TYPE "ProgrammeLevel" ADD VALUE IF NOT EXISTS 'DBA';

ALTER TABLE "Scholarship" ADD COLUMN IF NOT EXISTS "amountMax" DOUBLE PRECISION;
ALTER TABLE "Scholarship" ADD COLUMN IF NOT EXISTS "openDate" TIMESTAMP(3);
ALTER TABLE "Scholarship" ADD COLUMN IF NOT EXISTS "studyLevels" "ProgrammeLevel"[] NOT NULL DEFAULT ARRAY[]::"ProgrammeLevel"[];
ALTER TABLE "Scholarship" ADD COLUMN IF NOT EXISTS "fieldsOfStudy" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Scholarship" ADD COLUMN IF NOT EXISTS "showOnWebsite" BOOLEAN NOT NULL DEFAULT true;

-- Demo scholarships from prisma/seed.ts (fictional universities) must never appear on the public website.
UPDATE "Scholarship" SET "showOnWebsite" = false
WHERE "universityId" IN (
  SELECT "id" FROM "University" WHERE "name" IN ('University of Northbridge', 'Maple International University')
);
