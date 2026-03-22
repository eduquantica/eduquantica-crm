-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentInvoice" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "fileOpeningCharge" DOUBLE PRECISION,
    "serviceCharge" DOUBLE PRECISION,
    "serviceChargeType" TEXT,
    "serviceInstalment1" DOUBLE PRECISION,
    "serviceInstalment1Desc" TEXT,
    "serviceInstalment2" DOUBLE PRECISION,
    "serviceInstalment2Desc" TEXT,
    "ucasFee" DOUBLE PRECISION,
    "applicationFee" DOUBLE PRECISION,
    "applicationFeeDesc" TEXT,
    "otherDescription" TEXT,
    "otherAmount" DOUBLE PRECISION,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "status" TEXT NOT NULL DEFAULT 'DUE',
    "paymentMethod" TEXT,
    "paidAt" TIMESTAMP(3),
    "paidBy" TEXT,
    "receiptUrl" TEXT,
    "receiptFileName" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdByRole" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "agencyName" TEXT,
    "agencyLogo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethod_name_key" ON "PaymentMethod"("name");

-- CreateIndex
CREATE INDEX "PaymentMethod_type_idx" ON "PaymentMethod"("type");

-- CreateIndex
CREATE INDEX "PaymentMethod_isActive_idx" ON "PaymentMethod"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "StudentInvoice_invoiceNumber_key" ON "StudentInvoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "StudentInvoice_studentId_idx" ON "StudentInvoice"("studentId");

-- CreateIndex
CREATE INDEX "StudentInvoice_invoiceNumber_idx" ON "StudentInvoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "StudentInvoice_status_idx" ON "StudentInvoice"("status");

-- CreateIndex
CREATE INDEX "StudentInvoice_createdAt_idx" ON "StudentInvoice"("createdAt");

-- CreateIndex
CREATE INDEX "StudentInvoice_paidAt_idx" ON "StudentInvoice"("paidAt");

-- AddForeignKey
ALTER TABLE "StudentInvoice" ADD CONSTRAINT "StudentInvoice_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
