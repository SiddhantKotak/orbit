import { getOrCreateChat, listTemplates, prisma, upsertMemory } from "@brandloop/db";
import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { TurnContext } from "../context";
import { type HandoffEnvelope, type PostWriting } from "../specialists/envelope";
import { cleanup, fakeAi, testContext } from "../test/fixtures";
import type { WriterBlock } from "../writing/render";
import { delegateWritingRun } from "./delegate";
import { createDocumentFromHandoff } from "./documents";
import { buildTools } from "./index";

let ctx: TurnContext;
beforeEach(async () => {
  await cleanup();
  ctx = await testContext({ chatId: randomUUID() });
  await getOrCreateChat(ctx.profileId, ctx.userId, ctx.chatId);
});
afterAll(cleanup);

const PROSE: WriterBlock[] = [
  { kind: "hook", lines: ["Your first hire is a bet on you."] },
  { kind: "prose", lines: ["Write the role down first.", "Then talk to three people."] },
  { kind: "close", lines: ["Start with the problem they own."] },
];
const LISTY: WriterBlock[] = [
  { kind: "hook", lines: ["Your first hire is a bet on you."] },
  { kind: "bullets", lines: ["Three things to settle first:", "The problem they own", "What you will decide", "How you will know"] },
  { kind: "close", lines: ["Start with the problem they own."] },
];
const model = (blocks: WriterBlock[] = PROSE, over: Record<string, unknown> = {}) => ({
  summary: "A post.",
  findings: [],
  recommendation: "Create it.",
  missingInput: [],
  confidence: "medium",
  parentAction: "create-document",
  payload: { readiness: "ready", title: "First hire", postType: "framework", blocks, facts: [], missingFacts: [], clarifyingQuestion: null, ...over },
});
const REQUEST = "Write a post about hiring a first engineer for founders.";
const write = async (id = "call_w", input: Record<string, unknown> = {}) =>
  (await delegateWritingRun(ctx, { request: REQUEST, ...input }, id)) as HandoffEnvelope<PostWriting>;

const uses = () => prisma.templateUse.findMany({ where: { profileId: ctx.profileId } });
const formatOf = (ai: ReturnType<typeof fakeAi>) => ai.calls[0]!.prompt;

describe("auto-picked template", () => {
  it("shapes the draft with a template and records one auto TemplateUse when the post is created", async () => {
    ctx.ai = fakeAi(model());
    const out = await write();
    expect(out.payload.readiness).toBe("ready");
    expect(formatOf(ctx.ai as ReturnType<typeof fakeAi>)).toContain("<format>");
    expect(await uses()).toHaveLength(0); // nothing is recorded until a post exists
    const created = await createDocumentFromHandoff(ctx, { title: "T", kind: "text", specialistHandoffToolCallId: "call_w" });
    expect(created).toMatchObject({ success: true });
    const rows = await uses();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ source: "auto", documentId: (created as { id: string }).id });
  });

  it("uses the category of the picked angle, and never a template needing evidence the user did not give", async () => {
    ctx.pickedAngle = { question: "q", label: "l", brief: "b", category: "listicle" };
    const ai = fakeAi(model());
    ctx.ai = ai;
    await write();
    const row = (await listTemplates({ type: "POST", limit: 2_000 })).items;
    const chosen = ctx.templateChoices!.get("call_w")!;
    const t = row.find((r) => r.id === chosen.templateId)!;
    expect(t.category).toBe("listicle");
    expect(t.needs).toEqual([]);
  });

  it("does not repeat the template of the previous post", async () => {
    ctx.ai = fakeAi(model());
    await write("a");
    const first = ctx.templateChoices!.get("a")!.templateId;
    await prisma.templateUse.create({ data: { profileId: ctx.profileId, templateId: first, documentId: null, source: "auto" } });
    await write("b");
    expect(ctx.templateChoices!.get("b")!.templateId).not.toBe(first);
  });

  it("uses memory topics to lean toward the user's niche", async () => {
    await upsertMemory(ctx.profileId, "topics/hiring", "- hiring engineers", "USER");
    ctx.ai = fakeAi(model());
    const out = await write();
    expect(out.payload.readiness).toBe("ready");
  });
});

describe("pinned template", () => {
  it("is recorded as picked", async () => {
    const [pick] = (await listTemplates({ type: "POST", category: "educational", limit: 50 })).items.filter((t) => t.needs.length === 0);
    ctx.ai = fakeAi(model());
    await write("call_w", { templateSlug: pick!.slug });
    expect(formatOf(ctx.ai as ReturnType<typeof fakeAi>)).toContain(`("${pick!.title}")`);
    await createDocumentFromHandoff(ctx, { title: "T", kind: "text", specialistHandoffToolCallId: "call_w" });
    expect((await uses())[0]).toMatchObject({ templateId: pick!.id, source: "picked" });
  });

  it("an unknown slug is ignored and the server picks", async () => {
    ctx.ai = fakeAi(model());
    await write("call_w", { templateSlug: "no-such-template" });
    expect(ctx.templateChoices!.get("call_w")).toMatchObject({ source: "auto" });
  });

  it("needing a number the user has not given: the writer is told to ask, and no post is created", async () => {
    const needy = (await listTemplates({ type: "POST", limit: 2_000 })).items.find((t) => t.needs.includes("number") && !t.needs.includes("story") && !t.needs.includes("news"))!;
    const ai = fakeAi(model([], { readiness: "needs-user-input", missingFacts: ["What was the number?"], clarifyingQuestion: "What was the number?" }));
    ctx.ai = ai;
    const out = await write("call_w", { templateSlug: needy.slug });
    expect(ai.calls[0]!.prompt).toMatch(/needs a number or metric/);
    expect(ai.calls[0]!.prompt).toMatch(/needs-user-input/);
    expect(out.payload.readiness).toBe("needs-user-input");
    const created = await createDocumentFromHandoff(ctx, { title: "T", kind: "text", specialistHandoffToolCallId: "call_w" });
    expect(created).toMatchObject({ status: "needs-user-input" });
    expect(await uses()).toHaveLength(0);
  });

  it("is not told to ask when the request supplies the number", async () => {
    const needy = (await listTemplates({ type: "POST", limit: 2_000 })).items.find((t) => t.needs.length === 1 && t.needs[0] === "number")!;
    const ai = fakeAi(model());
    ctx.ai = ai;
    await write("call_w", { templateSlug: needy.slug, request: `${REQUEST} Churn fell by 37% in 90 days.` });
    expect(ai.calls[0]!.prompt).not.toMatch(/needs a number or metric/);
  });

  it("another profile's template is not used", async () => {
    const other = await prisma.template.create({ data: { slug: `private-${randomUUID()}`, type: "POST", category: "educational", title: "Private", skeleton: "[hook]\n\n[point]", beats: [], why: "w", needs: [], tags: [], system: false, profileId: (await prisma.profile.findFirstOrThrow({ where: { id: { not: ctx.profileId } } })).id } });
    try {
      ctx.ai = fakeAi(model());
      await write("call_w", { templateSlug: other.slug });
      expect(ctx.templateChoices!.get("call_w")).toMatchObject({ source: "auto" });
    } finally {
      await prisma.template.delete({ where: { id: other.id } });
    }
  });
});

describe("user rules win over the template", () => {
  it("a list template with a no-lists rule: the writer is told, and a list-free draft passes without a missing-list finding", async () => {
    await upsertMemory(ctx.profileId, "writing/rules", "- No bullet lists", "USER");
    const listy = (await listTemplates({ type: "POST", limit: 2_000 })).items.find((t) => t.needs.length === 0 && /^\s*(?:-|\d+\.)\s/m.test(t.skeleton) && t.skeleton.split("\n").filter((l) => /^\s*(?:-|\d+\.)\s/.test(l)).length >= 2)!;
    const ai = fakeAi(model());
    ctx.ai = ai;
    const out = await write("call_w", { templateSlug: listy.slug });
    expect(ai.calls[0]!.prompt).toContain("rules forbid lists");
    expect(out.findings.join("\n")).not.toMatch(/has a list/);
    expect(out.payload.readiness).toBe("ready");
  });

  it("a list in the draft breaks the no-lists rule", async () => {
    await upsertMemory(ctx.profileId, "writing/rules", "- No bullet lists", "USER");
    ctx.ai = fakeAi(model(LISTY));
    const out = await write();
    expect(out.findings.join("\n")).toMatch(/forbid lists/);
  });

  it("an auto-pick under a no-lists rule is never a list template", async () => {
    await upsertMemory(ctx.profileId, "writing/rules", "- No bullet lists", "USER");
    ctx.ai = fakeAi(model());
    for (let i = 0; i < 8; i++) {
      ctx.chatId = randomUUID();
      await write(`c${i}`);
      const id = ctx.templateChoices!.get(`c${i}`)!.templateId;
      const t = (await prisma.template.findUnique({ where: { id } }))!;
      expect(t.skeleton.split("\n").filter((l) => /^\s*(?:-|\d+\.)\s/.test(l)).length).toBeLessThan(2);
      await prisma.templateUse.create({ data: { profileId: ctx.profileId, templateId: id, documentId: null, source: "auto" } });
    }
  });
});

describe("template tools", () => {
  it("searchTemplates and readTemplate are offered and answer from the library", async () => {
    const tools = buildTools(ctx) as unknown as Record<string, { execute: (i: unknown, o: unknown) => Promise<string> }>;
    expect(Object.keys(tools)).toEqual(expect.arrayContaining(["searchTemplates", "readTemplate"]));
    const found = await tools.searchTemplates!.execute({ query: "list", category: null }, {});
    expect(found).toContain("template library");
    const slug = /^- (\S+) \|/m.exec(found)![1]!;
    const read = await tools.readTemplate!.execute({ slug }, {});
    expect(read).toContain("Skeleton:");
    expect(await tools.readTemplate!.execute({ slug: "nope" }, {})).toMatch(/Failed/);
  });
});

