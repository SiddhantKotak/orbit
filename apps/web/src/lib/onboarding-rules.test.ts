import { describe, expect, it } from "vitest";
import { compileHardRules } from "@brandloop/agent";
import { rulesFromToggles } from "@brandloop/db";

describe("onboarding toggles become hard writing rules", () => {
  it("every generated line is understood by the rules compiler", () => {
    const lines = rulesFromToggles({ allowEmoji: false, allowHashtags: false, allowDashes: false, allowLists: false, length: "short" });
    const { rules } = compileHardRules(lines.map((l) => `- ${l}`).join("\n"));
    expect(rules).toMatchObject({ forbidEmoji: true, forbidHashtags: true, forbidDashes: true, forbidLists: true });
  });
  it("allowed things produce no rule", () => {
    const lines = rulesFromToggles({ allowEmoji: true, allowHashtags: true, allowDashes: true, allowLists: true, length: "medium" });
    expect(compileHardRules(lines.join("\n")).rules).toMatchObject({ forbidEmoji: false, forbidHashtags: false, forbidDashes: false, forbidLists: false });
  });
});
