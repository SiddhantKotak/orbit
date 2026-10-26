import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../client";
import { listTemplates, recentTemplateUses, recordTemplateUse, setTemplateSaved, templateScores, upsertSystemTemplates, type SeedTemplate } from "./templates";
import { account, cleanupVisualTests } from "./visual-test-helpers";

const SLUGS = ["vtest-tpl-a", "vtest-tpl-b", "vtest-tpl-c"];
const row = (slug: string, over: Partial<SeedTemplate> = {}): SeedTemplate => ({
  slug,
  type: "HOOK",
  category: "vtest-story",
  title: `Title ${slug}`,
  skeleton: "I [did X]. Here is what happened.",
  beats: ["setup", "turn"],
  why: "Curiosity gap",
  needs: ["story"],
  tags: ["vtest"],
  ...over,
});
const seed = () =>
  upsertSystemTemplates([
    row("vtest-tpl-a"),
    row("vtest-tpl-b", { type: "POST", category: "vtest-list", title: "Seven lessons" }),
    row("vtest-tpl-c", { type: "POST", category: "vtest-story", title: "Zebra crossing", tags: ["vtest", "zebra"] }),
  ]);
const idOf = async (slug: string) => (await prisma.template.findUniqueOrThrow({ where: { slug } })).id;

async function cleanup() {
  await cleanupVisualTests();
  await prisma.template.deleteMany({ where: { slug: { in: SLUGS } } });
}
beforeEach(cleanup);
afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});


describe("templates", () => {
  it("lists by type, category and search with the right total, and upserts idempotently", async () => {
    expect(await seed()).toBe(3);
    await seed();
    expect(await prisma.template.count({ where: { slug: { in: SLUGS } } })).toBe(3);
    const only = (r: { items: { slug: string }[] }) => r.items.map((i) => i.slug).filter((s) => SLUGS.includes(s)).sort();
    expect(only(await listTemplates({ type: "POST", search: "vtest" }))).toEqual(["vtest-tpl-b", "vtest-tpl-c"]);
    const story = await listTemplates({ category: "vtest-story" });
    expect(story.total).toBe(2);
    expect(only(story)).toEqual(["vtest-tpl-a", "vtest-tpl-c"]);
    const zebra = await listTemplates({ search: "ZEBRA" });
    expect(zebra.total).toBe(1);
    expect(zebra.items[0]!.slug).toBe("vtest-tpl-c");
    const page = await listTemplates({ category: "vtest-story", limit: 1, offset: 1 });
    expect(page.total).toBe(2);
    expect(page.items).toHaveLength(1);
  });

  it("save and unsave toggle the savedBy filter", async () => {
    await seed();
    const a = await account("t1");
    const id = await idOf("vtest-tpl-a");
    await setTemplateSaved(a.profileId, id, true);
    await setTemplateSaved(a.profileId, id, true);
    expect((await listTemplates({ savedBy: a.profileId })).items.map((i) => i.slug)).toEqual(["vtest-tpl-a"]);
    await setTemplateSaved(a.profileId, id, false);
    expect((await listTemplates({ savedBy: a.profileId })).total).toBe(0);
  });

  it("recentTemplateUses is newest first and templateScores averages 1 - editRatio", async () => {
    await seed();
    const a = await account("t2");
    const [x, y, z] = await Promise.all(["vtest-tpl-a", "vtest-tpl-b", "vtest-tpl-c"].map(idOf));
    await recordTemplateUse({ profileId: a.profileId, templateId: x!, documentId: null, source: "auto" });
    await new Promise((r) => setTimeout(r, 15));
    await recordTemplateUse({ profileId: a.profileId, templateId: y!, documentId: null, source: "picked" });
    expect((await recentTemplateUses(a.profileId, 5)).map((u) => u.templateId)).toEqual([y, x]);
    expect(await recentTemplateUses(a.profileId, 1)).toHaveLength(1);

    await prisma.templateUse.updateMany({ where: { profileId: a.profileId, templateId: x }, data: { editRatio: 0.2 } });
    await prisma.templateUse.create({ data: { profileId: a.profileId, templateId: x!, source: "picked", editRatio: 0.4 } });
    const scores = await templateScores(a.profileId);
    expect(scores.get(x!)).toBeCloseTo(0.7);
    expect(scores.has(y!)).toBe(false);
    expect(scores.get(z!) ?? 0.5).toBe(0.5);
  });
});
