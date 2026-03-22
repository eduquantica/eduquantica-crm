-- CreateEnum
CREATE TYPE "CountryQualificationType" AS ENUM (
  'UK_ALEVEL',
  'UK_GCSE',
  'UK_BTEC',
  'IB_DIPLOMA',
  'BANGLADESH_SSC',
  'BANGLADESH_HSC',
  'INDIA_CLASS10',
  'INDIA_CLASS12',
  'PAKISTAN_MATRIC',
  'PAKISTAN_FSCINTERMEDIATE',
  'NIGERIA_WAEC',
  'NIGERIA_JAMB',
  'US_HIGHSCHOOL',
  'US_AP',
  'CANADA_HIGHSCHOOL',
  'AUSTRALIA_YEAR12',
  'MALAYSIA_STPM',
  'SRI_LANKA_AL',
  'NEPAL_SLC',
  'OTHER'
);

-- AlterEnum
ALTER TYPE "MatchStatus" ADD VALUE 'PENDING';

ALTER TABLE "CountryEntryRequirement"
ADD COLUMN "minimumSubjectsRequired" INTEGER,
ADD COLUMN "notes" TEXT,
ADD COLUMN "qualificationType_new" "CountryQualificationType";

UPDATE "CountryEntryRequirement"
SET "qualificationType_new" =
  CASE
    WHEN UPPER(COALESCE("qualificationType", '')) IN ('A_LEVEL', 'ALEVEL', 'GCE_A_LEVEL') THEN 'UK_ALEVEL'::"CountryQualificationType"
    WHEN UPPER(COALESCE("qualificationType", '')) IN ('GCSE') THEN 'UK_GCSE'::"CountryQualificationType"
    WHEN UPPER(COALESCE("qualificationType", '')) IN ('BTEC') THEN 'UK_BTEC'::"CountryQualificationType"
    WHEN UPPER(COALESCE("qualificationType", '')) IN ('IB', 'IB_DIPLOMA') THEN 'IB_DIPLOMA'::"CountryQualificationType"
    WHEN UPPER(COALESCE("qualificationType", '')) IN ('SSC') THEN 'BANGLADESH_SSC'::"CountryQualificationType"
    WHEN UPPER(COALESCE("qualificationType", '')) IN ('HSC', 'SSC_HSC') THEN 'BANGLADESH_HSC'::"CountryQualificationType"
    WHEN UPPER(COALESCE("qualificationType", '')) IN ('INDIA_CLASS10') THEN 'INDIA_CLASS10'::"CountryQualificationType"
    WHEN UPPER(COALESCE("qualificationType", '')) IN ('INDIA_CLASS12', 'PERCENTAGE') THEN 'INDIA_CLASS12'::"CountryQualificationType"
    WHEN UPPER(COALESCE("qualificationType", '')) IN ('O_LEVEL', 'PAKISTAN_MATRIC') THEN 'PAKISTAN_MATRIC'::"CountryQualificationType"
    WHEN UPPER(COALESCE("qualificationType", '')) IN ('FSC', 'PAKISTAN_FSCINTERMEDIATE') THEN 'PAKISTAN_FSCINTERMEDIATE'::"CountryQualificationType"
    WHEN UPPER(COALESCE("qualificationType", '')) IN ('WAEC', 'NECO', 'WAEC_NECO') THEN 'NIGERIA_WAEC'::"CountryQualificationType"
    WHEN UPPER(COALESCE("qualificationType", '')) IN ('JAMB') THEN 'NIGERIA_JAMB'::"CountryQualificationType"
    WHEN UPPER(COALESCE("qualificationType", '')) IN ('US_HIGHSCHOOL', 'HIGH_SCHOOL_DIPLOMA') THEN 'US_HIGHSCHOOL'::"CountryQualificationType"
    WHEN UPPER(COALESCE("qualificationType", '')) IN ('US_AP', 'AP') THEN 'US_AP'::"CountryQualificationType"
    WHEN UPPER(COALESCE("qualificationType", '')) IN ('CANADA_HIGHSCHOOL') THEN 'CANADA_HIGHSCHOOL'::"CountryQualificationType"
    WHEN UPPER(COALESCE("qualificationType", '')) IN ('AUSTRALIA_YEAR12', 'YEAR_12') THEN 'AUSTRALIA_YEAR12'::"CountryQualificationType"
    WHEN UPPER(COALESCE("qualificationType", '')) IN ('MALAYSIA_STPM', 'STPM') THEN 'MALAYSIA_STPM'::"CountryQualificationType"
    WHEN UPPER(COALESCE("qualificationType", '')) IN ('SRI_LANKA_AL') THEN 'SRI_LANKA_AL'::"CountryQualificationType"
    WHEN UPPER(COALESCE("qualificationType", '')) IN ('NEPAL_SLC', 'SLC', 'SEE') THEN 'NEPAL_SLC'::"CountryQualificationType"
    ELSE 'OTHER'::"CountryQualificationType"
  END;

UPDATE "CountryEntryRequirement"
SET "minimumSubjectsRequired" = "minimumSubjectCount"
WHERE "minimumSubjectCount" IS NOT NULL;

CREATE TABLE "CountrySubjectRequirement" (
  "id" TEXT NOT NULL,
  "countryEntryRequirementId" TEXT NOT NULL,
  "subjectName" TEXT NOT NULL,
  "minimumGrade" TEXT NOT NULL,
  "isMandatory" BOOLEAN NOT NULL DEFAULT true,
  "minimumUniversal" DOUBLE PRECISION,

  CONSTRAINT "CountrySubjectRequirement_pkey" PRIMARY KEY ("id")
);

INSERT INTO "CountrySubjectRequirement" (
  "id",
  "countryEntryRequirementId",
  "subjectName",
  "minimumGrade",
  "isMandatory"
)
SELECT
  'csr_' || md5(random()::text || clock_timestamp()::text || cer."id"),
  cer."id",
  TRIM(value),
  'N/A',
  true
FROM "CountryEntryRequirement" cer,
LATERAL regexp_split_to_table(COALESCE(cer."requiredSubjects", ''), ',') value
WHERE TRIM(value) <> '';

ALTER TABLE "CountryEntryRequirement"
DROP COLUMN "minimumSubjectCount",
DROP COLUMN "requiredSubjects",
DROP COLUMN "qualificationType";

ALTER TABLE "CountryEntryRequirement"
RENAME COLUMN "qualificationType_new" TO "qualificationType";

ALTER TABLE "CountryEntryRequirement"
ALTER COLUMN "qualificationType" SET NOT NULL;

CREATE INDEX "CountrySubjectRequirement_countryEntryRequirementId_idx" ON "CountrySubjectRequirement"("countryEntryRequirementId");
CREATE INDEX "CountrySubjectRequirement_isMandatory_idx" ON "CountrySubjectRequirement"("isMandatory");

ALTER TABLE "CountrySubjectRequirement"
ADD CONSTRAINT "CountrySubjectRequirement_countryEntryRequirementId_fkey"
FOREIGN KEY ("countryEntryRequirementId") REFERENCES "CountryEntryRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
