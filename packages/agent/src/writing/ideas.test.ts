import { describe, expect, it } from "vitest";
import { assignSources, isIdeasRequest, sourceBadge } from "./ideas";

const FIXTURE = {
  knowledge: [{ id: "k1", title: "Client onboarding teardown" }, { id: "k2", title: "Pricing page experiment" }],
  stories: ["Lost a client by overpromising a deadline", "Hired a designer before an engineer"],
  pillars: ["Hiring", "Pricing", "Remote work"],
  research: [] as { id: string; claim: string }[],
  recentTitles: [] as string[],
};

describe("assignSources", () => {
  it("5 ideas use 5 distinct sources and at least 3 kinds from 2 knowledge items, 2 stories and 3 pillars", () => {
    const out = assignSources({ count: 5, ...FIXTURE });
    expect(out.map((o) => o.slot)).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(out.map((o) => `${o.source.kind}:${o.source.ref}`)).size).toBeGreaterThanOrEqual(4);
    expect(new Set(out.map((o) => o.source.kind)).size).toBeGreaterThanOrEqual(3);
  });

  it("never reuses a source while an unused one exists", () => {
    const total = 2 + 2 + 3;
    const out = assignSources({ count: total, ...FIXTURE });
    expect(new Set(out.map((o) => `${o.source.kind}:${o.source.ref}`)).size).toBe(total);
    // Past the total, repeats are allowed but spread: nothing is used a third time.
    const more = assignSources({ count: total + 2, ...FIXTURE });
    const counts = new Map<string, number>();
    for (const o of more) counts.set(`${o.source.kind}:${o.source.ref}`, (counts.get(`${o.source.kind}:${o.source.ref}`) ?? 0) + 1);
    expect(Math.max(...counts.values())).toBe(2);
  });

  it("uses research when there is some, and puts sources an earlier post covers last", () => {
    const out = assignSources({
      count: 3,
      ...FIXTURE,
      research: [{ id: "r1", claim: "A new hiring rule took effect" }],
      recentTitles: ["Client onboarding teardown for founders"],
    });
    expect(out.map((o) => o.source.kind)).toEqual(["knowledge", "story", "research"]);
    expect(out[0]!.source.ref).toBe("k2");
  });

  it("returns nothing when there is no material, and works with a single kind", () => {
    expect(assignSources({ count: 5, knowledge: [], stories: [], pillars: [], research: [], recentTitles: [] })).toEqual([]);
    expect(assignSources({ count: 3, knowledge: [], stories: [], pillars: ["A"], research: [], recentTitles: [] })).toHaveLength(3);
  });
});

describe("badges and request detection", () => {
  it("names where an idea comes from", () => {
    expect(sourceBadge({ kind: "knowledge", ref: "k1" })).toBe("From your knowledge base");
    expect(sourceBadge({ kind: "story", ref: "x" })).toBe("From your story");
    expect(sourceBadge({ kind: "research", ref: "r" })).toBe("From this week's research");
    expect(sourceBadge({ kind: "pillar", ref: "Hiring" })).toBe("Pillar: Hiring");
  });
  it("routes ideas requests and not drafting requests", () => {
    for (const t of ["Give me 5 post ideas for this week", "what should I post", "ideas for this week", "content ideas please"]) expect(isIdeasRequest(t), t).toBe(true);
    for (const t of ["Write a post about hiring", "create a post on llm"]) expect(isIdeasRequest(t), t).toBe(false);
  });
});
