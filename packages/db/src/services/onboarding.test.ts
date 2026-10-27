import { readFileSync } from "node:fs";
import path from "node:path";
import { assertTestDatabase } from "../test-db";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { AiClient, Strategy as StrategyInput } from "@brandloop/ai";
import { prisma } from "../client";
import { createProfile, ensureAccount } from "./account";
import { listMemory } from "./memory";
import { getStrategy } from "./strategy";
import {
  aboutLines,
  deriveChecklist,
  dismissChecklist,
  finishOnboarding,
  getChecklist,
  getOnboarding,
  leaveOnboarding,
  restartOnboarding,
  rulesFromToggles,
  saveOnboardingStep,
  skipOnboardingStep,
} from "./onboarding";
import { draftStrategy } from "./strategy";

async function cleanup() {
  await assertTestDatabase(prisma);
  await prisma.user.deleteMany({ where: { clerkId: { startsWith: "user_test_onb" } } });
  await prisma.team.deleteMany({ where: { name: { endsWith: "(test)" } } });
}
beforeEach(cleanup);
afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

async function setup(suffix = "a") {
  const acc = await ensureAccount({ clerkId: `user_test_onb_${suffix}`, email: `onb${suffix}@example.test`, firstName: "Ona", teamNameSuffix: " (test)" });
  return { userId: acc.user.id, profileId: acc.currentProfile!.id, acc };
}
const about = { fullName: "Ona Reyes", jobTitle: "Design lead", company: "Fintech", timezone: "Europe/London" };
const section = async (profileId: string, key: string) => (await listMemory(profileId)).find((d) => d.key === key)?.content ?? "";

describe("who is onboarded", () => {
  it("a brand-new first profile starts un-onboarded at step 1; later profiles do not", async () => {
    const { userId, profileId } = await setup();
    expect(await getOnboarding(profileId)).toMatchObject({ completed: false, step: 1, answers: {} });
    const second = await createProfile(userId, { name: "Side" });
    expect((await getOnboarding(second.id)).completed).toBe(true);
  });

  it("the migration marks existing profiles complete and is recorded as applied", async () => {
    const { profileId } = await setup();
    const sql = readFileSync(path.join(__dirname, "../../prisma/migrations/20261028090000_onboarding_existing/migration.sql"), "utf8");
    const update = /UPDATE "Profile" SET "onboardingCompleted" = true/.exec(sql);
    expect(update).not.toBeNull();
    await prisma.$executeRawUnsafe(`${update![0]} WHERE "id" = '${profileId}'`);
    expect((await getOnboarding(profileId)).completed).toBe(true);
    const applied = await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM "_prisma_migrations" WHERE migration_name = '20261028090000_onboarding_existing' AND finished_at IS NOT NULL`;
    expect(Number(applied[0]!.n)).toBe(1);
  });
});

describe("step save and resume", () => {
  it("step 1 writes the profile and the About memory, and the resume point moves to 2", async () => {
    const { userId, profileId } = await setup();
    await saveOnboardingStep(userId, profileId, { step: 1, about });
    const p = await prisma.profile.findUniqueOrThrow({ where: { id: profileId } });
    expect(p).toMatchObject({ fullName: "Ona Reyes", jobTitle: "Design lead", company: "Fintech", timezone: "Europe/London", onboardingStep: 2, onboardingCompleted: false });
    expect(await section(profileId, "identity/about")).toBe("- Name: Ona Reyes\n- Role: Design lead\n- Company or industry: Fintech");
    expect((await getOnboarding(profileId)).answers.about).toEqual(about);
  });

  it("step 1 needs a name, a role and a real timezone", async () => {
    const { userId, profileId } = await setup();
    await expect(saveOnboardingStep(userId, profileId, { step: 1, about: { ...about, fullName: " " } })).rejects.toThrow("name");
    await expect(saveOnboardingStep(userId, profileId, { step: 1, about: { ...about, jobTitle: "" } })).rejects.toThrow("role");
    await expect(saveOnboardingStep(userId, profileId, { step: 1, about: { ...about, timezone: "Mars/Base" } })).rejects.toThrow("timezone");
    expect((await getOnboarding(profileId)).step).toBe(1);
  });

  it("running a step again replaces its own lines and keeps the person's other lines", async () => {
    const { userId, profileId } = await setup();
    await saveOnboardingStep(userId, profileId, { step: 1, about });
    await prisma.memoryDoc.update({ where: { profileId_key: { profileId, key: "identity/about" } }, data: { content: `${await section(profileId, "identity/about")}\n- Loves cycling` } });
    await saveOnboardingStep(userId, profileId, { step: 1, about: { ...about, jobTitle: "Head of design" } });
    const text = await section(profileId, "identity/about");
    expect(text).toContain("- Role: Head of design");
    expect(text).not.toContain("Design lead");
    expect(text).toContain("- Loves cycling");
  });

  it("step 2 maps goal and audience into About and the offer into Offers", async () => {
    const { userId, profileId } = await setup();
    await saveOnboardingStep(userId, profileId, { step: 1, about });
    await saveOnboardingStep(userId, profileId, {
      step: 2,
      goal: { goal: "clients", note: "B2B only" },
      audience: { roles: ["CTO"], industries: ["Fintech"], sizes: ["50-200"], text: "" },
      offer: "Design audits",
    });
    expect(await section(profileId, "identity/about")).toContain("- LinkedIn goal: Win clients. B2B only");
    expect(await section(profileId, "identity/about")).toContain("- Target audience: roles: CTO; industries: Fintech; company size: 50-200");
    expect(await section(profileId, "identity/offers")).toBe("- Offer: Design audits");
    expect((await getOnboarding(profileId)).step).toBe(3);
  });

  it("step 3 writes hard writing rules from the toggles", async () => {
    const { userId, profileId } = await setup();
    await saveOnboardingStep(userId, profileId, { step: 3, voice: { mode: "none", voiceStyleId: null, allowEmoji: false, allowHashtags: true, allowDashes: false, allowLists: true, length: "short" } });
    const rules = (await section(profileId, "writing/rules")).split("\n");
    expect(rules).toEqual(["- No emojis.", "- No dashes.", "- Keep posts short, under 700 characters."]);
    await saveOnboardingStep(userId, profileId, { step: 3, voice: { mode: "none", voiceStyleId: null, allowEmoji: true, allowHashtags: true, allowDashes: true, allowLists: true, length: "medium" } });
    expect(await section(profileId, "writing/rules")).toBe("");
  });

  it("step 3 selects a preset voice", async () => {
    const { userId, profileId } = await setup();
    const preset = await prisma.voiceStyle.findFirst({ where: { kind: "PRESET" } });
    if (!preset) return; // the preset seed is part of e2e setup
    await saveOnboardingStep(userId, profileId, { step: 3, voice: { mode: "preset", voiceStyleId: preset.id, allowEmoji: false, allowHashtags: false, allowDashes: true, allowLists: true, length: "medium" } });
    expect((await prisma.profile.findUniqueOrThrow({ where: { id: profileId } })).voiceStyleId).toBe(preset.id);
  });

  it("step 4 writes topics and stories, never anything the person did not enter", async () => {
    const { userId, profileId } = await setup();
    await saveOnboardingStep(userId, profileId, { step: 4, topics: { topics: ["Design systems", "design systems", "Hiring"], stories: ["Shipped a system in 6 weeks"] } });
    expect(await section(profileId, "topics/known-for")).toBe("- Topic: Design systems\n- Topic: Hiring");
    expect(await section(profileId, "identity/story")).toBe("- Story 1: Shipped a system in 6 weeks");
    await saveOnboardingStep(userId, profileId, { step: 4, topics: { topics: [], stories: [] } });
    expect(await section(profileId, "identity/story")).toBe("");
  });

  it("skip moves on without writing; step 1 cannot be skipped", async () => {
    const { userId, profileId } = await setup();
    await skipOnboardingStep(userId, profileId, 2);
    expect(await getOnboarding(profileId)).toMatchObject({ step: 3, answers: { skipped: [2] } });
    expect(await listMemory(profileId)).toHaveLength(0);
    await expect(skipOnboardingStep(userId, profileId, 1)).rejects.toThrow();
    await expect(skipOnboardingStep(userId, profileId, 5)).rejects.toThrow();
  });

  it("another user cannot write to the profile", async () => {
    const { profileId } = await setup("a");
    const other = await setup("b");
    await expect(saveOnboardingStep(other.userId, profileId, { step: 1, about })).rejects.toThrow("Profile not found");
  });
});

const strategy: StrategyInput = {
  goal: "build_authority",
  goalWhy: "w",
  positioning: "p",
  positioningWhy: "w",
  tagline: "t",
  expertise: "e",
  expertiseWhy: "w",
  contentMix: [{ type: "educational", percent: 100 }],
  audienceBalance: [{ level: "broad", percent: 100, note: "n" }],
  contentFormats: [{ format: "text", perWeek: 3, note: "n" }],
  recurringSeries: [{ name: "n", weekday: "mon", description: "d" }],
};

describe("strategy draft and confirm", () => {
  it("drafting saves nothing; the strategy is saved only on finish", async () => {
    const { userId, profileId } = await setup();
    let seen = "";
    const ai = { text: async () => "", json: async ({ prompt }: { prompt: string }) => ((seen = prompt), strategy) } as unknown as AiClient;
    const draft = await draftStrategy(ai, profileId, { goal: "Win clients", audience: "CTOs <script>", topics: ["Design systems"] });
    expect(draft.positioning).toBe("p");
    expect(await getStrategy(profileId)).toBeNull();
    expect(seen).toContain("Primary goal: Win clients");
    expect(seen).toContain("Wants to be known for: Design systems");
    expect(seen).not.toContain("<script>");

    await finishOnboarding(userId, profileId, strategy);
    expect((await getStrategy(profileId))?.positioning).toBe("p");
    const state = await getOnboarding(profileId);
    expect(state.completed).toBe(true);
    expect(state.answers.finishedAt).toBeTruthy();
  });

  it("leaving sets completed without a strategy; set up again keeps answers and the app open", async () => {
    const { userId, profileId } = await setup();
    await saveOnboardingStep(userId, profileId, { step: 1, about });
    await leaveOnboarding(userId, profileId);
    expect(await getStrategy(profileId)).toBeNull();
    await restartOnboarding(userId, profileId);
    expect(await getOnboarding(profileId)).toMatchObject({ completed: true, step: 1, answers: { about } });
  });
});

describe("getting started checklist", () => {
  it("derives done from real counts; sprint and LinkedIn are never auto-done", () => {
    const items = deriveChecklist({ documents: 1, knowledge: 0, templateSaves: 2 });
    expect(items.map((i) => [i.id, i.done])).toEqual([["first-post", true], ["knowledge", false], ["template", true], ["sprint", false], ["linkedin", false]]);
    expect(items.find((i) => i.id === "linkedin")?.comingSoon).toBe(true);
  });

  it("shows only after finishing, and not once dismissed", async () => {
    const { userId, profileId } = await setup();
    expect(await getChecklist(profileId)).toBeNull();
    await finishOnboarding(userId, profileId, null);
    const list = await getChecklist(profileId);
    expect(list?.find((i) => i.id === "first-post")?.done).toBe(false);
    await prisma.document.create({ data: { profileId, title: "A post" } });
    expect((await getChecklist(profileId))?.find((i) => i.id === "first-post")?.done).toBe(true);
    await dismissChecklist(userId, profileId);
    expect(await getChecklist(profileId)).toBeNull();
  });
});

describe("pure mapping", () => {
  it("about lines skip an empty company", () => {
    expect(aboutLines({ ...about, company: "" })).toEqual(["Name: Ona Reyes", "Role: Design lead"]);
  });
  it("toggles to rules", () => {
    expect(rulesFromToggles({ allowEmoji: true, allowHashtags: true, allowDashes: true, allowLists: false, length: "long" })).toEqual(["No bullet lists.", "Posts can run long, up to 1,800 characters."]);
  });
});
