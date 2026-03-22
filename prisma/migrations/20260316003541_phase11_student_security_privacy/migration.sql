-- AlterTable
ALTER TABLE "StudentPreferences" ADD COLUMN     "accountDeletionReason" TEXT,
ADD COLUMN     "accountDeletionRequestedAt" TIMESTAMP(3),
ADD COLUMN     "privacyAllowMarketing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "privacyProfileVisible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "privacyShareAnalytics" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "twoFactorBackupCodes" JSONB,
ADD COLUMN     "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "twoFactorEnabledAt" TIMESTAMP(3);
