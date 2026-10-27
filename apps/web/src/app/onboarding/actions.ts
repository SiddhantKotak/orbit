"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import {
  AccountError,
  MemoryVersionConflict,
  ONBOARDING_GOALS,
  dismissChecklist,
  finishOnboarding,
  leaveOnboarding,
  restartOnboarding,
  saveOnboardingStep,
  setOnboardingStep,
  skipOnboardingStep,
} from "@brandloop/db";
import { StrategySchema } from "@brandloop/ai";
import { ACCOUNT_CACHE_TAG, getAccount } from "@/lib/account";

export type OnboardingResult = { ok: true } | { ok: false; error: string };

const list = (max: number) => z.array(z.string().max(600)).max(max);
const GoalIds = Object.keys(ONBOARDING_GOALS) as [keyof typeof ONBOARDING_GOALS, ...(keyof typeof ONBOARDING_GOALS)[]];

const StepSchema = z.discriminatedUnion("step", [
  z.object({
    step: z.literal(1),
    about: z.object({ fullName: z.string().max(200), jobTitle: z.string().max(200), company: z.string().max(300), timezone: z.string().max(80) }),
  }),
  z.object({
    step: z.literal(2),
    goal: z.object({ goal: z.enum(GoalIds), note: z.string().max(400) }),
    audience: z.object({ roles: list(12), industries: list(12), sizes: list(8), text: z.string().max(600) }),
    offer: z.string().max(800),
  }),
  z.object({
    step: z.literal(3),
    voice: z.object({
      mode: z.enum(["preset", "own", "none"]),
      voiceStyleId: z.string().max(60).nullable(),
      allowEmoji: z.boolean(),
      allowHashtags: z.boolean(),
      allowDashes: z.boolean(),
      allowLists: z.boolean(),
      length: z.enum(["short", "medium", "long"]),
    }),
  }),
  z.object({ step: z.literal(4), topics: z.object({ topics: list(10), stories: list(4) }) }),
]);

/** Runs one onboarding write for the current profile, then expires the cached account so the app gate sees it at once. */
async function run(fn: (userId: string, profileId: string) => Promise<unknown>): Promise<OnboardingResult> {
  const account = await getAccount();
  const profileId = account.currentProfile?.id;
  if (!profileId) return { ok: false, error: "Choose a profile first" };
  try {
    await fn(account.user.id, profileId);
  } catch (err) {
    if (err instanceof AccountError) return { ok: false, error: err.message };
    if (err instanceof MemoryVersionConflict) return { ok: false, error: "Your memory changed while saving. Try again." };
    throw err;
  }
  updateTag(ACCOUNT_CACHE_TAG);
  return { ok: true };
}

export async function saveStepAction(data: unknown): Promise<OnboardingResult> {
  const parsed = StepSchema.safeParse(data);
  if (!parsed.success) return { ok: false, error: "Some answers aren't valid. Check them and try again." };
  return run((userId, profileId) => saveOnboardingStep(userId, profileId, parsed.data));
}

export async function skipStepAction(step: number): Promise<OnboardingResult> {
  return run((userId, profileId) => skipOnboardingStep(userId, profileId, step));
}

export async function goToStepAction(step: number): Promise<OnboardingResult> {
  return run((userId, profileId) => setOnboardingStep(userId, profileId, step));
}

/** Confirms the reviewed strategy (or none) and finishes. This is the only place the onboarding strategy is saved. */
export async function finishAction(strategy: unknown): Promise<OnboardingResult> {
  const parsed = strategy === null ? null : StrategySchema.safeParse(strategy);
  if (parsed && !parsed.success) return { ok: false, error: "That strategy isn't valid" };
  return run((userId, profileId) => finishOnboarding(userId, profileId, parsed ? parsed.data : null));
}

export async function leaveAction(): Promise<OnboardingResult> {
  return run(leaveOnboarding);
}

export async function restartAction(): Promise<OnboardingResult> {
  return run(restartOnboarding);
}

export async function dismissChecklistAction(): Promise<OnboardingResult> {
  return run(dismissChecklist);
}
