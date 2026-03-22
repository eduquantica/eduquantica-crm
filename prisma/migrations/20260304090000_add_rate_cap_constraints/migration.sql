DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'SubAgent_commissionRate_max_90'
  ) THEN
    ALTER TABLE "SubAgent"
      ADD CONSTRAINT "SubAgent_commissionRate_max_90"
      CHECK ("commissionRate" <= 90);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'SubAgentAgreement_currentRate_max_90'
  ) THEN
    ALTER TABLE "SubAgentAgreement"
      ADD CONSTRAINT "SubAgentAgreement_currentRate_max_90"
      CHECK ("currentRate" <= 90);
  END IF;
END $$;
