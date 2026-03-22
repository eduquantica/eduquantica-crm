-- Add onboarding completion flag for student onboarding wizard
ALTER TABLE "Student"
ADD COLUMN IF NOT EXISTS "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false;