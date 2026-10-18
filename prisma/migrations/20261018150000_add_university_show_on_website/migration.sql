-- Public website course search: lets staff hide a university (and all its courses) from the website.
ALTER TABLE "University" ADD COLUMN IF NOT EXISTS "showOnWebsite" BOOLEAN NOT NULL DEFAULT true;

-- Demo universities from prisma/seed.ts must never appear on the public website.
UPDATE "University" SET "showOnWebsite" = false
WHERE "name" IN ('University of Northbridge', 'Maple International University', 'Southern Pacific Institute');
