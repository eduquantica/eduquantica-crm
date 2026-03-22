-- CreateTable
CREATE TABLE "PLOffice" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "city" TEXT,
    "code" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "subAgentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PLOffice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PLIncome" (
    "id" TEXT NOT NULL,
    "officeId" TEXT,
    "subAgentId" TEXT,
    "source" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "receivedDate" TIMESTAMP(3) NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "relatedEntityId" TEXT,
    "isSystemGenerated" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PLIncome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PLExpense" (
    "id" TEXT NOT NULL,
    "officeId" TEXT,
    "subAgentId" TEXT,
    "expenseType" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "incurredDate" TIMESTAMP(3) NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "relatedEntityId" TEXT,
    "isCostOfSale" BOOLEAN NOT NULL DEFAULT false,
    "isSystemGenerated" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PLExpense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PLOffice_country_idx" ON "PLOffice"("country");

-- CreateIndex
CREATE INDEX "PLOffice_subAgentId_idx" ON "PLOffice"("subAgentId");

-- CreateIndex
CREATE INDEX "PLOffice_isActive_idx" ON "PLOffice"("isActive");

-- CreateIndex
CREATE INDEX "PLIncome_officeId_idx" ON "PLIncome"("officeId");

-- CreateIndex
CREATE INDEX "PLIncome_subAgentId_idx" ON "PLIncome"("subAgentId");

-- CreateIndex
CREATE INDEX "PLIncome_year_month_idx" ON "PLIncome"("year", "month");

-- CreateIndex
CREATE INDEX "PLIncome_source_idx" ON "PLIncome"("source");

-- CreateIndex
CREATE INDEX "PLIncome_receivedDate_idx" ON "PLIncome"("receivedDate");

-- CreateIndex
CREATE INDEX "PLIncome_isSystemGenerated_idx" ON "PLIncome"("isSystemGenerated");

-- CreateIndex
CREATE INDEX "PLExpense_officeId_idx" ON "PLExpense"("officeId");

-- CreateIndex
CREATE INDEX "PLExpense_subAgentId_idx" ON "PLExpense"("subAgentId");

-- CreateIndex
CREATE INDEX "PLExpense_year_month_idx" ON "PLExpense"("year", "month");

-- CreateIndex
CREATE INDEX "PLExpense_expenseType_idx" ON "PLExpense"("expenseType");

-- CreateIndex
CREATE INDEX "PLExpense_incurredDate_idx" ON "PLExpense"("incurredDate");

-- CreateIndex
CREATE INDEX "PLExpense_isCostOfSale_idx" ON "PLExpense"("isCostOfSale");

-- CreateIndex
CREATE INDEX "PLExpense_isSystemGenerated_idx" ON "PLExpense"("isSystemGenerated");

-- AddForeignKey
ALTER TABLE "PLOffice" ADD CONSTRAINT "PLOffice_subAgentId_fkey" FOREIGN KEY ("subAgentId") REFERENCES "SubAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PLIncome" ADD CONSTRAINT "PLIncome_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "PLOffice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PLIncome" ADD CONSTRAINT "PLIncome_subAgentId_fkey" FOREIGN KEY ("subAgentId") REFERENCES "SubAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PLExpense" ADD CONSTRAINT "PLExpense_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "PLOffice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PLExpense" ADD CONSTRAINT "PLExpense_subAgentId_fkey" FOREIGN KEY ("subAgentId") REFERENCES "SubAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
