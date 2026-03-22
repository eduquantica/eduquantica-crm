ALTER TABLE "Commission"
  ADD COLUMN IF NOT EXISTS "calculatedAt" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'UniversityCommissionAgreement_commissionRate_max_30'
  ) THEN
    ALTER TABLE "UniversityCommissionAgreement"
      ADD CONSTRAINT "UniversityCommissionAgreement_commissionRate_max_30"
      CHECK ("commissionRate" <= 30);
  END IF;
END $$;
