import { describe, expect, it } from "vitest";
import { comparisonMarkdown, reportMarkdown, type RunRecord } from "./report";
import { DIMENSIONS } from "./rubric";

const run: RunRecord = {
  run: 1,
  startedAt: "2026-10-01T00:00:00Z",
  models: { generate: "g", extract: "e" },
  turns: [
    {
      promptId: "a", chat: "c1", prompt: "What do you remember?", latencyMs: 1000, finish: "stop",
      tokens: { orchestrator: { input: 1, output: 2 }, specialists: { input: 3, output: 4 } },
      tools: [], text: "Hi.", documentBefore: null, documentAfter: null, documentChange: "none", checks: [], logs: [], verdict: null,
      pairwise: { order: "orbit-first", result: { winner: "A", reason: "Clearer." } as never, winner: "orbit" },
    },
  ],
  aggregate: { perDimension: Object.fromEntries(DIMENSIONS.map((d) => [d, 4])) as never, perPrompt: { a: 4 }, overall: 4 },
  pairwise: { orbit: 1, kleo: 0, tie: 0 },
  cleanup: {},
};

describe("eval report", () => {
  it("keeps the repo report Orbit-only", () => {
    const md = reportMarkdown([run]);
    expect(md).toContain("## Scores by run");
    expect(md).not.toMatch(/kleo|pairwise|wins/i);
  });

  it("puts the comparison in the local report only", () => {
    const md = comparisonMarkdown([run]);
    expect(md).toContain("Orbit wins");
    expect(md).toContain("Clearer.");
  });
});
