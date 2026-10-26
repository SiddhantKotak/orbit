import { describe, expect, it } from "vitest";
import type { StyleProfile } from "@brandloop/ai";
import { DEFAULT_TARGETS } from "./rules";
import { pickExamplePosts } from "./examples";
import { renderExamplesBlock } from "./inject";
import { SPECIALIST_SYSTEM } from "../specialists/prompts";

const style = { layout: { ...DEFAULT_TARGETS, postChars: { low: 50, typical: 100, high: 200 } } } as unknown as StyleProfile;
const post = (text: string, source: string, day: number) => ({ text, source, postedAt: new Date(2026, 0, day) });
const t = (c: string, n = 100) => c.repeat(n);

describe("pickExamplePosts", () => {
  it("prefers ORBIT, then EXPORT, then PASTE, newest first, max 3", () => {
    const out = pickExamplePosts(
      [post(t("p"), "PASTE", 9), post(t("e1"), "EXPORT", 1), post(t("o1"), "ORBIT", 1), post(t("e2"), "EXPORT", 5), post(t("o2"), "ORBIT", 4)].map((x) => ({ ...x, text: x.text.slice(0, 100) })),
      style,
    );
    expect(out).toHaveLength(3);
    expect(out[0]).toContain("o2");
    expect(out[1]).toContain("o1");
    expect(out[2]).toContain("e2");
  });
  it("puts posts inside the length range ahead of out-of-range ones", () => {
    const out = pickExamplePosts([post("x".repeat(500), "ORBIT", 9), post("y".repeat(100), "PASTE", 1)], style, 1);
    expect(out[0]).toMatch(/^y/);
  });
  it("returns nothing for an empty corpus", () => {
    expect(pickExamplePosts([], style)).toEqual([]);
  });
});

describe("renderExamplesBlock", () => {
  it("is empty without posts", () => expect(renderExamplesBlock([])).toBe(""));
  it("stops at a post boundary when the budget is reached", () => {
    const out = renderExamplesBlock(["a".repeat(100), "b".repeat(100), "c".repeat(100)], 450);
    expect(out).toContain("a".repeat(100));
    expect(out).toContain("b".repeat(100));
    expect(out).not.toContain("c".repeat(100));
    expect(out.length).toBeLessThanOrEqual(450);
  });
  it("states they are style references only", () => {
    expect(renderExamplesBlock(["hello"])).toMatch(/never reuse their facts/);
  });
});

describe("writer prompt", () => {
  it("tells the writer not to reuse the examples' facts", () => {
    expect(SPECIALIST_SYSTEM["post-writing"]).toMatch(/<examples>[^\n]*never reuse their facts/);
  });
});
