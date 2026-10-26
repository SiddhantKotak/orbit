import type { TemplateRow } from "@brandloop/db";
import { describe, expect, it } from "vitest";
import { pickTemplate, type PickInput } from "./pick";

const t = (id: string, over: Partial<TemplateRow> = {}): TemplateRow =>
  ({ id, slug: id, type: "POST", category: "educational", title: id, skeleton: "[hook]", beats: [], why: "", needs: [], tags: [], system: true, profileId: null, ...over }) as unknown as TemplateRow;

const base = (over: Partial<PickInput> = {}): PickInput => ({
  candidates: [],
  category: null,
  evidence: { hasStory: false, numbers: [], hasNews: false },
  recent: [],
  scores: new Map(),
  nicheTerms: [],
  seed: "s",
  ...over,
});

describe("pickTemplate", () => {
  it("returns null when nothing is eligible", () => {
    expect(pickTemplate(base())).toBeNull();
    expect(pickTemplate(base({ candidates: [t("a", { needs: ["story"] })] }))).toBeNull();
  });

  it("drops templates whose evidence is missing, and keeps them once it is supplied", () => {
    const candidates = [t("story", { needs: ["story"] }), t("plain")];
    expect(pickTemplate(base({ candidates, category: "educational" }))!.id).toBe("plain");
    const withStory = base({ candidates: [t("story", { needs: ["story"], category: "story" }), t("plain")], category: "story", evidence: { hasStory: true, numbers: [], hasNews: false } });
    expect(pickTemplate(withStory)!.id).toBe("story");
    expect(pickTemplate(base({ candidates: [t("n", { needs: ["number"] })] }))).toBeNull();
    expect(pickTemplate(base({ candidates: [t("n", { needs: ["number"] })], evidence: { hasStory: false, numbers: ["37%"], hasNews: false } }))!.id).toBe("n");
    expect(pickTemplate(base({ candidates: [t("w", { needs: ["news"] })], evidence: { hasStory: false, numbers: [], hasNews: true } }))!.id).toBe("w");
  });

  it("a category match (+3) beats two niche tags (+2)", () => {
    const candidates = [t("tags", { category: "opinion", tags: ["pricing", "saas"] }), t("cat", { category: "lesson" })];
    expect(pickTemplate(base({ candidates, category: "lesson", nicheTerms: ["pricing", "saas"] }))!.id).toBe("cat");
    expect(pickTemplate(base({ candidates, category: null, nicheTerms: ["pricing", "saas"] }))!.id).toBe("tags");
  });

  it("caps the niche bonus at +2", () => {
    const candidates = [t("many", { tags: ["a", "b", "c", "d"] }), t("cat", { category: "lesson" })];
    expect(pickTemplate(base({ candidates, category: "lesson", nicheTerms: ["a", "b", "c", "d"] }))!.id).toBe("cat");
  });

  it("past edit scores shift the pick; a template without history counts as 0.5", () => {
    const candidates = [t("liked"), t("disliked"), t("new")];
    const scores = new Map([["liked", 1], ["disliked", 0]]);
    expect(pickTemplate(base({ candidates, scores }))!.id).toBe("liked");
    expect(pickTemplate(base({ candidates: [t("disliked"), t("new")], scores }))!.id).toBe("new");
  });

  it("skips recent templates while fresh ones exist", () => {
    const candidates = [t("a", { category: "lesson" }), t("b")];
    expect(pickTemplate(base({ candidates, category: "lesson", recent: ["a"] }))!.id).toBe("b");
  });

  it("when every eligible template is recent, the least recent wins", () => {
    const candidates = [t("a"), t("b"), t("c")];
    // newest first: a, b, c  -> c was used longest ago
    expect(pickTemplate(base({ candidates, recent: ["a", "b", "c"] }))!.id).toBe("c");
    expect(pickTemplate(base({ candidates, recent: ["c", "a", "b"] }))!.id).toBe("b");
  });

  it("a recent template that the evidence gate drops does not count as fresh or stale", () => {
    const candidates = [t("a"), t("gated", { needs: ["story"] })];
    expect(pickTemplate(base({ candidates, recent: ["a"] }))!.id).toBe("a");
  });

  it("is deterministic for a seed and varies across seeds on a tie", () => {
    const candidates = Array.from({ length: 20 }, (_, i) => t(`t${i}`));
    const first = pickTemplate(base({ candidates, seed: "x" }))!.id;
    for (let i = 0; i < 5; i++) expect(pickTemplate(base({ candidates: [...candidates].reverse(), seed: "x" }))!.id).toBe(first);
    const picks = new Set(Array.from({ length: 30 }, (_, i) => pickTemplate(base({ candidates, seed: `seed${i}` }))!.id));
    expect(picks.size).toBeGreaterThan(3);
  });
});
