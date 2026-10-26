import { assertTestDatabase } from "../test-db";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { AiClient } from "@brandloop/ai";
import { prisma } from "../client";
import { seedPresets } from "../../prisma/seed";
import { LEGACY_PRESET_SLUGS, PRESET_VOICES } from "../../prisma/presets";
import { ensureAccount } from "./account";
import { createOwnVoice, getSelectedVoice, listVoices, selectVoice } from "./voice";

async function cleanup() {
  await assertTestDatabase(prisma);
  await prisma.user.deleteMany({ where: { clerkId: { startsWith: "user_test_" } } });
  await prisma.team.deleteMany({ where: { name: { endsWith: "(test)" } } });
}
beforeEach(cleanup);
afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

const fake = (result: unknown): AiClient =>
  ({ json: async () => result, text: async () => "" }) as unknown as AiClient;

async function account(n: number) {
  const acc = await ensureAccount({
    clerkId: `user_test_voice${n}`,
    email: `voice${n}@example.test`,
    firstName: "Voice",
    teamNameSuffix: " (test)",
  });
  return { userId: acc.user.id, profileId: acc.currentProfile!.id };
}

const dd = (t: string) => ({ do: [`Do ${t}`], dont: [`Avoid ${t}`] });
const extractedStyle = {
  language: "en-GB",
  voiceTarget: "Write plainly.",
  rules: { hooks: dd("hooks"), rhythm: dd("rhythm"), formatting: dd("formatting"), diction: dd("diction"), closings: dd("closings"), global: dd("global") },
  signatureMoves: [],
  finalChecks: [],
  referencePostIndexes: [0, 1, 2],
  postTypes: ["story", "story", "story"],
};

const post = (n: number) => `Post ${n}. ` + "A sentence about shipping work that matters. ".repeat(6);

describe("presets", () => {
  const slugs = PRESET_VOICES.map((p) => p.slug);

  it("seeding twice leaves exactly the 10 current presets, each with the four guide sections", async () => {
    await seedPresets(prisma);
    await seedPresets(prisma);
    expect(PRESET_VOICES).toHaveLength(10);
    expect(await prisma.voiceStyle.count({ where: { kind: "PRESET", slug: { in: slugs } } })).toBe(10);
    for (const p of PRESET_VOICES) {
      expect(p.tagline, p.slug).not.toBe("");
      for (const h of ["## Rhythm", "## Structure", "## Signature moves", "## Avoid"]) expect(p.guide).toContain(h);
    }
  });

  it("leaves a selected retired preset untouched and lists it only for the profile that selected it", async () => {
    await seedPresets(prisma);
    const old = await prisma.voiceStyle.upsert({
      where: { slug: LEGACY_PRESET_SLUGS[0]! },
      update: {},
      create: { slug: LEGACY_PRESET_SLUGS[0]!, kind: "PRESET", name: "Old preset", profileVersion: 2 },
    });
    const a = await account(10);
    const b = await account(11);
    await selectVoice(a.userId, a.profileId, old.id);
    await seedPresets(prisma);
    const after = await prisma.voiceStyle.findUniqueOrThrow({ where: { id: old.id } });
    expect(after).toMatchObject({ name: old.name, profileVersion: 2 });
    const listA = (await listVoices(a.profileId)).filter((v) => v.kind === "PRESET").map((v) => v.slug);
    expect(listA.slice(0, 10)).toEqual(slugs);
    expect(listA).toContain(old.slug);
    const listB = (await listVoices(b.profileId)).map((v) => v.slug);
    expect(listB).not.toContain(old.slug);
    expect(listB.filter((s) => s && slugs.includes(s))).toEqual(slugs);
  });
});

describe("createOwnVoice", () => {
  it("rejects fewer than 3 posts with the exact message", async () => {
    const { profileId } = await account(1);
    await expect(createOwnVoice(fake({}), profileId, [post(1), post(2)])).rejects.toThrow(
      "Paste at least 3 posts of 200+ characters",
    );
    await expect(createOwnVoice(fake({}), profileId, [post(1), post(2), "short"])).rejects.toThrow(
      "Paste at least 3 posts of 200+ characters",
    );
  });

  it("creates an OWN voice and mirrors the guide into voice/style", async () => {
    const { profileId } = await account(2);
    const ai = fake(extractedStyle);
    const voice = await createOwnVoice(ai, profileId, [post(1), post(2), post(3)]);
    expect(voice).toMatchObject({ kind: "OWN", profileId, status: "READY" });
    expect(voice.samplePosts).toHaveLength(3);
    const mem = await prisma.memoryDoc.findUnique({ where: { profileId_key: { profileId, key: "voice/style" } } });
    expect(mem?.content).toContain("## Rhythm");
    expect(mem?.content).toContain("Write plainly.");
    expect(mem?.source).toBe("MIRRORED");
    // Creating again updates the same row.
    await createOwnVoice(ai, profileId, [post(4), post(5), post(6)]);
    expect(await prisma.voiceStyle.count({ where: { profileId, kind: "OWN" } })).toBe(1);
  });
});

describe("selecting", () => {
  it("selectVoice sets Profile.voiceStyleId for a preset; getSelectedVoice reads it", async () => {
    const { userId, profileId } = await account(3);
    await seedPresets(prisma);
    const preset = (await prisma.voiceStyle.findUniqueOrThrow({ where: { slug: PRESET_VOICES[0]!.slug } }));
    await selectVoice(userId, profileId, preset.id);
    expect((await prisma.profile.findUnique({ where: { id: profileId } }))?.voiceStyleId).toBe(preset.id);
    expect((await getSelectedVoice(profileId))?.id).toBe(preset.id);
    const list = await listVoices(profileId);
    expect(list.filter((v) => v.kind === "PRESET")).toHaveLength(10);
  });

  it("falls back to the own style, else null; rejects another profile's own voice", async () => {
    const a = await account(4);
    const b = await account(5);
    expect(await getSelectedVoice(a.profileId)).toBeNull();
    const own = await createOwnVoice(fake(extractedStyle), a.profileId, [post(1), post(2), post(3)]);
    expect((await getSelectedVoice(a.profileId))?.id).toBe(own.id);
    await expect(selectVoice(b.userId, b.profileId, own.id)).rejects.toThrow(/not found/i);
  });
});
