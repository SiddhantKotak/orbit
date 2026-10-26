import { describe, expect, it } from "vitest";
import type { TemplateRow } from "@brandloop/db";
import { FRAMEWORKS } from "../library";
import { ChatRequestSchema } from "../types";
import { lintPost } from "./lint";
import { planHasList, renderFormatBlock, selectFormat } from "./format";
import { resolveRules } from "./rules";

const none = { postType: null, style: null, request: "r", template: null };
const tpl = (slug: string, skeleton: string): TemplateRow =>
  ({ id: "t1", slug, type: "POST", category: "framework", title: "A named framework", skeleton, beats: [], why: "", needs: [], tags: [], system: true }) as unknown as TemplateRow;
const NAMED = "The [Name] test:\n1. [Question]\n2. [Question]\n3. [Question]\n\n[How to use it].";

describe("selectFormat", () => {
  it("a picked format wins over everything else", () => {
    const f = selectFormat({ ...none, selectedFormatId: "myth-truth", postType: "short" });
    expect(f).toMatchObject({ id: "myth-truth", source: "picked", name: "Myth, truth, proof" });
    expect(f.plan).toEqual(FRAMEWORKS.find((x) => x.id === "myth-truth")!.plan);
  });

  it("a pinned template becomes a plan with its skeleton", () => {
    const f = selectFormat({ ...none, selectedFormatId: "fw-named", template: tpl("fw-named", NAMED) });
    expect(f).toMatchObject({ id: "fw-named", source: "picked", name: "A named framework" });
    expect(f.skeleton).toContain("[Name]");
    expect(f.plan.map((b) => b.kind)).toEqual(["numbered", "prose"]);
  });

  it("an auto-picked template reports source auto", () => {
    expect(selectFormat({ ...none, selectedFormatId: null, template: tpl("fw-named", NAMED) }).source).toBe("auto");
  });

  it("an unknown pinned id with no template is ignored and the post type decides", () => {
    const f = selectFormat({ ...none, selectedFormatId: "gone", postType: "short" });
    expect(f).toMatchObject({ id: null, source: "post-type" });
  });

  it("every framework renders a block of at most 1,200 characters", () => {
    for (const f of FRAMEWORKS) expect(renderFormatBlock(selectFormat({ ...none, selectedFormatId: f.id })).length).toBeLessThanOrEqual(1_200);
    expect(renderFormatBlock(selectFormat({ ...none, selectedFormatId: "x", template: tpl("x", NAMED) })).length).toBeLessThanOrEqual(1_200);
  });

  it("an unfilled template slot fails the placeholders check", () => {
    const v = lintPost("[Claim about topic].\n\n[Why most people miss it].", resolveRules({ userRulesMarkdown: "", style: null, turn: {} }), { postType: null, groundingText: null, researchDates: null, personalDetails: "allowed" });
    expect(v.violations.some((x) => x.id === "placeholders" && x.level === "hard")).toBe(true);
  });

  it("a plan with a list makes a missing list a target violation", () => {
    const rules = resolveRules({ userRulesMarkdown: "", style: null, turn: {} });
    const ctx = { postType: null, groundingText: null, researchDates: null, personalDetails: "allowed" as const, expectList: true };
    expect(lintPost("Hook.\n\nBody.", rules, ctx).violations.find((v) => v.id === "list-expected")?.level).toBe("target");
    expect(lintPost("Hook.\n\n- a\n- b", rules, ctx).violations.find((v) => v.id === "list-expected")).toBeUndefined();
  });

  it("the chat request accepts a known format id and accepts any slug (unknown ones are ignored server-side)", () => {
    const base = { id: crypto.randomUUID(), runId: crypto.randomUUID(), message: { id: "m", role: "user", parts: [{ type: "text", text: "hi" }] } };
    expect(ChatRequestSchema.safeParse({ ...base, selectedFormatId: "myth-truth" }).success).toBe(true);
    expect(ChatRequestSchema.safeParse(base).data?.selectedFormatId).toBeNull();
    expect(ChatRequestSchema.safeParse({ ...base, selectedFormatId: "not-a-format" }).success).toBe(true);
  });
});
