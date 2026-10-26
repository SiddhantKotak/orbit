import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { OptionsPanel as PanelData } from "@brandloop/agent/client";
import { nextFocus, OptionsPanel } from "./options-panel";

const panel: PanelData = {
  pickerToolCallId: "c1",
  preamble: null,
  question: "Which angle should the LLM post take?",
  options: [
    { id: "a", label: "The myth", explainer: "Contrarian." },
    { id: "b", label: "The steps", explainer: "Practical." },
    { id: "c", label: "The mistake", explainer: "Memorable." },
  ],
  recommendedOptionId: "b",
  allowFreeInput: true,
  freeInputPlaceholder: "Or tell me something else…",
};

describe("OptionsPanel", () => {
  const html = renderToStaticMarkup(<OptionsPanel panel={panel} onPick={() => {}} onClose={() => {}} />);

  it("renders the question as a heading, numbered rows with explainers, and a close button", () => {
    expect(html).toMatch(/<h2[^>]*>Which angle should the LLM post take\?<\/h2>/);
    expect(html.match(/data-option="/g)).toHaveLength(3);
    expect(html).toContain("The myth");
    expect(html).toContain("Practical.");
    expect(html).toContain('aria-label="Close options"');
    expect(html).toContain(">3</span>");
  });

  it("badges only the recommended row", () => {
    expect(html.match(/data-suggested/g)).toHaveLength(1);
    expect(html).toMatch(/The steps[\s\S]*?Suggested/);
  });

  it("shows the free-input hint only when allowed", () => {
    expect(html).toContain("Or write or tell Orbit your own answer in the chat below");
    const off = renderToStaticMarkup(<OptionsPanel panel={{ ...panel, allowFreeInput: false }} onPick={() => {}} onClose={() => {}} />);
    expect(off).not.toContain("data-options-hint");
  });
});

describe("nextFocus", () => {
  it("moves with the arrows, wrapping, and ignores other keys", () => {
    expect(nextFocus("ArrowDown", 0, 3)).toBe(1);
    expect(nextFocus("ArrowDown", 2, 3)).toBe(0);
    expect(nextFocus("ArrowUp", 0, 3)).toBe(2);
    expect(nextFocus("Home", 2, 3)).toBe(0);
    expect(nextFocus("End", 0, 3)).toBe(2);
    expect(nextFocus("a", 0, 3)).toBeNull();
    expect(nextFocus("ArrowDown", 0, 0)).toBeNull();
  });
});
