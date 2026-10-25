import { describe, expect, it } from "vitest";
import { openPanelOf, panelsOf, parseOptionsPanel } from "./options";

const output = {
  shown: true,
  preamble: "Intro.",
  question: "Which angle?",
  options: [
    { id: "a", label: "Alpha", explainer: "one" },
    { id: "b", label: "Beta", explainer: "two" },
  ],
  recommendedOptionId: "b",
  allowFreeInput: true,
  freeInputPlaceholder: "Or tell me something else…",
};
const part = { type: "tool-presentOptions", toolCallId: "c1", state: "output-available", output };
const asst = { role: "assistant", parts: [part] };
const user = (text: string, optionPick?: object) => ({ role: "user", parts: [{ type: "text", text }], metadata: optionPick ? { optionPick } : {} });

describe("options panel", () => {
  it("parses a finished call and rejects partial or malformed ones", () => {
    expect(parseOptionsPanel(part)?.options).toHaveLength(2);
    expect(parseOptionsPanel({ ...part, state: "input-available" })).toBeNull();
    expect(parseOptionsPanel({ ...part, output: { shown: true, question: "q", options: [{ id: "a", label: "x", explainer: "y" }] } })).toBeNull();
  });

  it("is open until a user message follows, then answers with the picked label", () => {
    expect(openPanelOf([user("create a post on llm"), asst])?.pickerToolCallId).toBe("c1");
    const picked = [user("hi"), asst, user("Beta", { pickerToolCallId: "c1", optionId: "b" })];
    expect(openPanelOf(picked)).toBeNull();
    expect(panelsOf(picked, 1)[0]?.answer).toBe("Beta");
  });

  it("treats typed text as the answer", () => {
    expect(panelsOf([user("hi"), asst, user("Make it about cost")], 1)[0]?.answer).toBe("Make it about cost");
  });
});
