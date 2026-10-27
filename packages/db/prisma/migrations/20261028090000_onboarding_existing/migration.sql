-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "onboardingAnswers" JSONB,
ADD COLUMN     "onboardingStep" INTEGER NOT NULL DEFAULT 1;

-- Profiles that exist before onboarding shipped are never sent through it.
UPDATE "Profile" SET "onboardingCompleted" = true;
