-- Add per-category student notification preferences
ALTER TABLE "StudentPreferences"
ADD COLUMN "financePortalNotifications" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "financeEmailNotifications" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "messagePortalNotifications" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "messageEmailNotifications" BOOLEAN NOT NULL DEFAULT true;
