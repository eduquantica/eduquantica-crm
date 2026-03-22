-- Remove BRONZE from sub-agent tier model and allow no-tier state below SILVER threshold.

UPDATE "SubAgentTierCertificate"
SET "tier" = 'SILVER'
WHERE "tier"::text = 'BRONZE';

ALTER TYPE "SubAgentTier" RENAME TO "SubAgentTier_old";

CREATE TYPE "SubAgentTier" AS ENUM ('SILVER', 'GOLD', 'PLATINUM');

ALTER TABLE "SubAgent"
  ALTER COLUMN "tier" DROP DEFAULT,
  ALTER COLUMN "tier" DROP NOT NULL,
  ALTER COLUMN "tier" TYPE "SubAgentTier"
  USING (
    CASE
      WHEN "tier" IS NULL OR "tier"::text = 'BRONZE' THEN NULL
      ELSE "tier"::text::"SubAgentTier"
    END
  );

ALTER TABLE "SubAgentTierCertificate"
  ALTER COLUMN "tier" TYPE "SubAgentTier"
  USING (
    CASE
      WHEN "tier"::text = 'BRONZE' THEN 'SILVER'::"SubAgentTier"
      ELSE "tier"::text::"SubAgentTier"
    END
  );

DROP TYPE "SubAgentTier_old";
