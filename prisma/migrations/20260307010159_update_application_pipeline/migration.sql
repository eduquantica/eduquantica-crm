/*
  Warnings:

  - The values [DRAFT,SUBMITTED,UNDER_REVIEW,VISA_APPROVED,VISA_REJECTED] on the enum `ApplicationStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "VisaSubStatus" AS ENUM ('VISA_PENDING', 'VISA_APPROVED', 'VISA_REJECTED');

-- AlterEnum
BEGIN;
ALTER TABLE "Application" ADD COLUMN "statusLegacy" TEXT;
UPDATE "Application" SET "statusLegacy" = "status"::text;
CREATE TYPE "ApplicationStatus_new" AS ENUM ('APPLIED', 'DOCUMENTS_PENDING', 'DOCUMENTS_SUBMITTED', 'SUBMITTED_TO_UNIVERSITY', 'CONDITIONAL_OFFER', 'UNCONDITIONAL_OFFER', 'FINANCE_IN_PROGRESS', 'DEPOSIT_PAID', 'FINANCE_COMPLETE', 'CAS_ISSUED', 'VISA_APPLIED', 'ENROLLED', 'WITHDRAWN');
ALTER TABLE "public"."Application" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Application" ALTER COLUMN "status" TYPE "ApplicationStatus_new" USING (
  CASE
    WHEN "status"::text = 'DRAFT' THEN 'APPLIED'
    WHEN "status"::text = 'SUBMITTED' THEN 'SUBMITTED_TO_UNIVERSITY'
    WHEN "status"::text = 'UNDER_REVIEW' THEN 'SUBMITTED_TO_UNIVERSITY'
    WHEN "status"::text = 'VISA_APPROVED' THEN 'VISA_APPLIED'
    WHEN "status"::text = 'VISA_REJECTED' THEN 'VISA_APPLIED'
    ELSE "status"::text
  END::"ApplicationStatus_new"
);
ALTER TYPE "ApplicationStatus" RENAME TO "ApplicationStatus_old";
ALTER TYPE "ApplicationStatus_new" RENAME TO "ApplicationStatus";
DROP TYPE "public"."ApplicationStatus_old";
ALTER TABLE "Application" ALTER COLUMN "status" SET DEFAULT 'APPLIED';
COMMIT;

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "casIssuedAt" TIMESTAMP(3),
ADD COLUMN     "casNumber" TEXT,
ADD COLUMN     "conditionalOfferAt" TIMESTAMP(3),
ADD COLUMN     "enrolledAt" TIMESTAMP(3),
ADD COLUMN     "financeCompleteAt" TIMESTAMP(3),
ADD COLUMN     "offerConditions" TEXT,
ADD COLUMN     "submittedToUniversityAt" TIMESTAMP(3),
ADD COLUMN     "unconditionalOfferAt" TIMESTAMP(3),
ADD COLUMN     "visaApplicationRef" TEXT,
ADD COLUMN     "visaAppliedAt" TIMESTAMP(3),
ADD COLUMN     "visaRejectionReason" TEXT,
ADD COLUMN     "visaSubStatus" "VisaSubStatus",
ADD COLUMN     "visaVignetteRef" TEXT,
ADD COLUMN     "withdrawalReason" TEXT,
ADD COLUMN     "withdrawnAt" TIMESTAMP(3),
ALTER COLUMN "status" SET DEFAULT 'APPLIED';

UPDATE "Application"
SET "visaSubStatus" = CASE
  WHEN "statusLegacy" = 'VISA_APPROVED' THEN 'VISA_APPROVED'::"VisaSubStatus"
  WHEN "statusLegacy" = 'VISA_REJECTED' THEN 'VISA_REJECTED'::"VisaSubStatus"
  WHEN "status" = 'VISA_APPLIED' THEN 'VISA_PENDING'::"VisaSubStatus"
  ELSE NULL
END;

ALTER TABLE "Application" DROP COLUMN "statusLegacy";
