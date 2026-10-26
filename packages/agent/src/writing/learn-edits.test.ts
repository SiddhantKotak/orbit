import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { AiClient, StyleProfile } from "@brandloop/ai";
import { ensureAccount, prisma, restoreStyleVersion, saveStyleProfile } from "@brandloop/db";
import { PRESET_VOICES } from "../../../db/prisma/presets";
import { editDelta, learnFromEdit, noteDocumentEdit, runStyleLearn } from "./learn-edits";

const AI = "Most founders hire too early.\n\nThey chase titles and forget the work itself.\n\nHire for the problem you have today, not the one you imagine next year.\n\nWhat would you do differently?";
const EDITED = "Most founders hire too early.\n\nThey chase titles. The work itself gets forgotten.\n\nHire for today's problem.\n\nTell me what you would change.";
const TYPO = AI.replace("imagine", "imagin");

const base = (): StyleProfile => ({ ...structuredClone(PRESET_VOICES[0]!.profile), source: { kind: "own", postCount: 4, corpusHash: "h", compiledAt: "2026-10-22T00:00:00.000Z", model: "test" } });

/** A fake model that returns the current rules plus the given extra rules, and counts calls. */
function fake(extra: Partial<Record<"hooks" | "rhythm" | "formatting" | "diction" | "closings" | "global", { do?: string[]; dont?: string[] }>>) {
  const calls = { n: 0 };
  const ai = {
    async json({ prompt, schema }: { prompt: string; schema: { parse(v: unknown): unknown } }) {
      calls.n++;
      const rules = JSON.parse(/<current_rules>\n([\s\S]*?)\n<\/current_rules>/.exec(prompt)![1]!);
      for (const [area, add] of Object.entries(extra)) {
        rules[area].do.push(...(add.do ?? []));
        rules[area].dont.push(...(add.dont ?? []));
      }
      return schema.parse({ rules });
    },
    async text() {
      return "";
    },
  } as unknown as AiClient;
  return { ai, calls };
}

describe("editDelta", () => {
  it("is ~0 for a typo, 0 for no change and large for a rewrite", () => {
    expect(editDelta(AI, AI).ratio).toBe(0);
    expect(editDelta(AI, TYPO).ratio).toBeLessThan(0.05);
    const d = editDelta(AI, EDITED);
    expect(d.ratio).toBeGreaterThan(0.2);
    expect(d.added.join(" ")).toContain("Tell me");
    expect(d.removed.join(" ")).toContain("differently?");
  });
});

describe("learnFromEdit", () => {
  it("adds a style rule from a real edit and keeps everything else", async () => {
    const { ai } = fake({ closings: { dont: ["End on a question."] } });
    const out = await learnFromEdit(ai, { profile: base(), aiText: AI, userText: EDITED });
    expect(out.changed).toBe(true);
    expect(out.rules.closings.dont).toContain("End on a question.");
    expect(out.rules.hooks).toEqual(base().rules.hooks);
  });

  it("never writes a fact, a quote or a writing instruction as a rule", async () => {
    const { ai } = fake({
      global: { do: ["Mention that the author hired 3 engineers in Pune", "Wants a post about hiring", "Say \"tell me what you would change\"", "Tell me what you would change always"] },
    });
    const out = await learnFromEdit(ai, { profile: base(), aiText: AI, userText: EDITED });
    expect(out.changed).toBe(false);
    expect(JSON.stringify(out.rules)).not.toMatch(/Pune|Wants a post|tell me what/i);
  });

  it("ignores a tiny edit without calling the model", async () => {
    const { ai, calls } = fake({ global: { do: ["Anything."] } });
    expect((await learnFromEdit(ai, { profile: base(), aiText: AI, userText: TYPO })).changed).toBe(false);
    expect(calls.n).toBe(0);
  });

  it("keeps at most 7 per list and 3 new rules per edit", async () => {
    const { ai } = fake({ global: { do: ["Use plain verbs.", "Lead with the claim.", "Prefer short words.", "Cut adverbs."] } });
    const p = base();
    const before = p.rules.global.do.length;
    const out = await learnFromEdit(ai, { profile: p, aiText: AI, userText: EDITED });
    expect(out.rules.global.do.length).toBeLessThanOrEqual(7);
    expect(out.rules.global.do.length).toBeLessThanOrEqual(before + 3);
  });
});

describe("runStyleLearn and noteDocumentEdit", () => {
  async function cleanup() {
    await prisma.user.deleteMany({ where: { clerkId: { startsWith: "user_test_learn" } } });
    await prisma.team.deleteMany({ where: { name: { endsWith: "(learn-test)" } } });
  }
  beforeEach(cleanup);
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  async function setup(withOwn = true) {
    const acc = await ensureAccount({ clerkId: "user_test_learn1", email: "learn1@example.test", firstName: "L", teamNameSuffix: " (learn-test)" });
    const profileId = acc.currentProfile!.id;
    let styleId: string | null = null;
    if (withOwn) {
      const style = await prisma.voiceStyle.create({ data: { profileId, kind: "OWN", name: "Mine", status: "PENDING" } });
      await saveStyleProfile(style.id, base(), "h");
      await prisma.profile.update({ where: { id: profileId }, data: { voiceStyleId: style.id } });
      styleId = style.id;
    }
    const doc = await prisma.document.create({ data: { profileId, title: "Hiring", version: 2 } });
    await prisma.documentVersion.create({ data: { documentId: doc.id, version: 1, text: AI, source: "AI_CREATE" } });
    // The user's edit is saved after the style's version (the real order).
    await new Promise((r) => setTimeout(r, 20));
    await prisma.documentVersion.create({ data: { documentId: doc.id, version: 2, text: EDITED, source: "USER_EDIT" } });
    const tpl = await prisma.template.upsert({
      where: { slug: "learn-test-tpl" },
      update: {},
      create: { slug: "learn-test-tpl", type: "POST", category: "t", title: "T", skeleton: "s", beats: [], why: "w", needs: [], tags: [] },
    });
    const use = await prisma.templateUse.create({ data: { profileId, templateId: tpl.id, documentId: doc.id, source: "auto" } });
    return { profileId, styleId, docId: doc.id, useId: use.id };
  }
  const versions = (id: string) => prisma.voiceStyleVersion.count({ where: { voiceStyleId: id } });

  it("a real edit makes exactly one new version; a second run on the same text makes none; revert restores the prior profile", async () => {
    const s = await setup();
    const { ai } = fake({ closings: { dont: ["End on a question."] } });
    expect(await versions(s.styleId!)).toBe(1);
    expect(await runStyleLearn(ai, { profileId: s.profileId, documentId: s.docId })).toBe("learned");
    expect(await versions(s.styleId!)).toBe(2);
    const after = await prisma.voiceStyle.findUniqueOrThrow({ where: { id: s.styleId! } });
    expect(JSON.stringify(after.styleProfile)).toContain("End on a question.");
    expect(after.profileVersion).toBe(2);

    expect(await runStyleLearn(ai, { profileId: s.profileId, documentId: s.docId })).toBe("skipped");
    expect(await versions(s.styleId!)).toBe(2);

    await restoreStyleVersion(s.profileId, s.styleId!, 1);
    const reverted = await prisma.voiceStyle.findUniqueOrThrow({ where: { id: s.styleId! } });
    expect(JSON.stringify(reverted.styleProfile)).not.toContain("End on a question.");
    expect((reverted.styleProfile as StyleProfile).rules).toEqual(base().rules);
  });

  it("stores the edit ratio on the matching template use, for tiny edits too, without learning", async () => {
    const s = await setup();
    const note = await noteDocumentEdit(s.profileId, s.docId);
    expect(note?.enqueue).toBe(true);
    expect((await prisma.templateUse.findUniqueOrThrow({ where: { id: s.useId } })).editRatio).toBeCloseTo(note!.ratio);
    await prisma.documentVersion.update({ where: { documentId_version: { documentId: s.docId, version: 2 } }, data: { text: TYPO } });
    const tiny = await noteDocumentEdit(s.profileId, s.docId);
    expect(tiny?.enqueue).toBe(false);
    expect((await prisma.templateUse.findUniqueOrThrow({ where: { id: s.useId } })).editRatio).toBeLessThan(0.05);
    const { ai, calls } = fake({ global: { do: ["X."] } });
    expect(await runStyleLearn(ai, { profileId: s.profileId, documentId: s.docId })).toBe("skipped");
    expect(calls.n).toBe(0);
    expect(await versions(s.styleId!)).toBe(1);
  });

  it("learns nothing when the user has no own style (a preset is never changed)", async () => {
    const s = await setup(false);
    const { ai, calls } = fake({ global: { do: ["X."] } });
    expect(await runStyleLearn(ai, { profileId: s.profileId, documentId: s.docId })).toBe("skipped");
    expect(calls.n).toBe(0);
  });
});
