-- Add lock + reupload metadata and scan thresholds for Copyleaks integration
ALTER TABLE "Document"
ADD COLUMN "uploadedAfterApproval" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "DocumentScanResult"
ADD COLUMN "isLocked" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ScanSettings"
ADD COLUMN "plagiarismGreenMax" DOUBLE PRECISION NOT NULL DEFAULT 15,
ADD COLUMN "plagiarismAmberMax" DOUBLE PRECISION NOT NULL DEFAULT 30,
ADD COLUMN "aiGreenMax" DOUBLE PRECISION NOT NULL DEFAULT 20,
ADD COLUMN "aiAmberMax" DOUBLE PRECISION NOT NULL DEFAULT 40;
