import { describe, expect, it } from "vitest";
import { suggestTopics } from "./onboarding-topics";

describe("suggestTopics", () => {
  it("leads with topics for the role and keeps the list capped and unique", () => {
    const t = suggestTopics({ jobTitle: "Design lead", company: "Fintech", goal: "clients" });
    expect(t[0]).toBe("Design systems");
    expect(t).toContain("Client results");
    expect(t.length).toBeLessThanOrEqual(10);
    expect(new Set(t).size).toBe(t.length);
  });
  it("falls back to generic topics", () => {
    expect(suggestTopics({ jobTitle: "Zookeeper" })).toContain("Lessons from my work");
  });
});
