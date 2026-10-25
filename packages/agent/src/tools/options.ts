import { tool } from "ai";
import { z } from "zod";

const OptionInput = z.object({
  id: z.string().min(1).max(40),
  label: z.string().min(1).max(120),
  explainer: z.string().min(1).max(240),
  /** The detailed writing instructions for this option. Stays on the server: never part of the tool's output. */
  brief: z.string().min(1).max(2_000),
});

export const PresentOptionsInput = z
  .object({
    preamble: z.string().max(300).nullable(),
    question: z.string().min(1).max(200),
    options: z.array(OptionInput).min(2).max(5),
    recommendedOptionId: z.string().nullable(),
    allowFreeInput: z.boolean().nullable(),
    freeInputPlaceholder: z.string().max(120).nullable(),
  })
  .refine((v) => new Set(v.options.map((o) => o.id)).size === v.options.length, { message: "option ids must be unique", path: ["options"] })
  .refine((v) => !v.recommendedOptionId || v.options.some((o) => o.id === v.recommendedOptionId), {
    message: "recommendedOptionId must be one of the option ids",
    path: ["recommendedOptionId"],
  });
// Fields are nullable rather than optional so the schema works in OpenAI strict mode, like the other tools.
export type PresentOptionsInput = z.infer<typeof PresentOptionsInput>;

/** What the picker UI gets: everything but the briefs. */
export type PresentOptionsOutput = {
  shown: true;
  preamble: string | null;
  question: string;
  options: { id: string; label: string; explainer: string }[];
  recommendedOptionId: string | null;
  allowFreeInput: boolean;
  freeInputPlaceholder: string;
};

export const DEFAULT_FREE_INPUT_PLACEHOLDER = "Or tell me something else…";

export function presentOptionsOutput(input: PresentOptionsInput): PresentOptionsOutput {
  return {
    shown: true,
    preamble: input.preamble?.trim() || null,
    question: input.question,
    options: input.options.map(({ id, label, explainer }) => ({ id, label, explainer })),
    recommendedOptionId: input.recommendedOptionId ?? null,
    allowFreeInput: input.allowFreeInput ?? true,
    freeInputPlaceholder: input.freeInputPlaceholder?.trim() || DEFAULT_FREE_INPUT_PLACEHOLDER,
  };
}

export type OptionPick = { pickerToolCallId: string; optionId: string };
export type PickedAngle = { question: string; label: string; brief: string };

type StoredMessage = { role: string; parts: unknown };

/**
 * The option a user picked, read from the picker's STORED tool call. The client only names the picker and the
 * option; the label and the brief always come from what the assistant stored, never from the request.
 */
export function resolveOptionPick(messages: StoredMessage[], pick: OptionPick | null | undefined): PickedAngle | null {
  if (!pick) return null;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!;
    if (m.role !== "assistant" || !Array.isArray(m.parts)) continue;
    for (const part of m.parts as { type?: unknown; toolCallId?: unknown; input?: unknown }[]) {
      if (part?.type !== "tool-presentOptions" || part.toolCallId !== pick.pickerToolCallId) continue;
      const parsed = PresentOptionsInput.safeParse(part.input);
      if (!parsed.success) return null;
      const option = parsed.data.options.find((o) => o.id === pick.optionId);
      return option ? { question: parsed.data.question, label: option.label, brief: option.brief } : null;
    }
  }
  return null;
}

export function optionTools() {
  return {
    presentOptions: tool({
      description:
        "Ask the user to choose between options, shown as a panel above their message box. Use it for a new post when the user gave only a topic: offer 3 or 4 distinct angles. `question` is the heading. Each option has a short `label`, a one-line `explainer` of why it works, and a hidden `brief`: complete writing instructions for that angle, grounded in what you know about the user, never inventing personal facts. Set `recommendedOptionId` to the best fit (null if none). Pass null for fields you do not need; allowFreeInput null means true. The turn ends after this call: add at most the one-sentence `preamble`, never list the options in text.",
      inputSchema: PresentOptionsInput,
      execute: (input) => presentOptionsOutput(input),
      toModelOutput: () => ({ type: "text", value: "The options are on the user's screen. Stop now and wait for their pick." }),
    }),
  };
}
