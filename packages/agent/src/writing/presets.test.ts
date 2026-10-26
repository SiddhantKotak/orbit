import { describe, expect, it } from "vitest";
import { StyleProfileSchema } from "@brandloop/ai";
import { PRESET_VOICES } from "../../../db/prisma/presets";
import { resolveRules } from "./rules";
import { renderStyleBlock, STYLE_BUDGET } from "./inject";

describe("preset writing styles", () => {
  it("has the 10 archetypes with unique slugs", () => {
    expect(PRESET_VOICES).toHaveLength(10);
    expect(new Set(PRESET_VOICES.map((p) => p.slug)).size).toBe(10);
  });

  for (const p of PRESET_VOICES) {
    it(`${p.name} parses and renders within the style budget`, () => {
      expect(StyleProfileSchema.safeParse(p.profile).success).toBe(true);
      const rules = resolveRules({ userRulesMarkdown: "", style: p.profile, turn: {} });
      const block = renderStyleBlock(p.profile, rules, { postType: null, budget: STYLE_BUDGET });
      expect(block.length).toBeLessThanOrEqual(STYLE_BUDGET);
      expect(block).toContain(p.profile.voiceTarget);
    });
  }
});
