-- Profit & Loss monthly statement schema update

ALTER TABLE "PLIncome"
ADD COLUMN "studentCommission" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "applicationFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "serviceCharge" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "otherIncome" JSONB[] NOT NULL DEFAULT ARRAY[]::JSONB[],
ADD COLUMN "totalIncome" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "periodKey" TEXT;

ALTER TABLE "PLIncome"
ALTER COLUMN "amount" SET DEFAULT 0,
ALTER COLUMN "source" DROP NOT NULL,
ALTER COLUMN "receivedDate" DROP NOT NULL;

UPDATE "PLIncome"
SET
	"studentCommission" = COALESCE("amount", 0),
	"applicationFee" = 0,
	"serviceCharge" = 0,
	"otherIncome" = ARRAY[]::JSONB[],
	"totalIncome" = COALESCE("amount", 0),
	"periodKey" = CONCAT('legacy-income:', "id")
WHERE "periodKey" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "PLIncome_periodKey_key" ON "PLIncome"("periodKey");

ALTER TABLE "PLExpense"
ADD COLUMN "rent" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "salaries" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "marketing" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "operations" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "legal" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "travel" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "otherExpenses" JSONB[] NOT NULL DEFAULT ARRAY[]::JSONB[],
ADD COLUMN "totalExpenses" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "periodKey" TEXT;

ALTER TABLE "PLExpense"
ALTER COLUMN "amount" SET DEFAULT 0,
ALTER COLUMN "expenseType" DROP NOT NULL,
ALTER COLUMN "incurredDate" DROP NOT NULL;

UPDATE "PLExpense"
SET
	"rent" = COALESCE("amount", 0),
	"salaries" = 0,
	"marketing" = 0,
	"operations" = 0,
	"legal" = 0,
	"travel" = 0,
	"otherExpenses" = ARRAY[]::JSONB[],
	"totalExpenses" = COALESCE("amount", 0),
	"periodKey" = CONCAT('legacy-expense:', "id")
WHERE "periodKey" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "PLExpense_periodKey_key" ON "PLExpense"("periodKey");
