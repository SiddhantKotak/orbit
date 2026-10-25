/** Client-safe helpers for the options panel (presentOptions). Nothing here imports server code. */
export type OptionsPanel = {
  pickerToolCallId: string;
  preamble: string | null;
  question: string;
  options: { id: string; label: string; explainer: string }[];
  recommendedOptionId: string | null;
  allowFreeInput: boolean;
  freeInputPlaceholder: string;
};

type PartLike = { type: string; state?: string; toolCallId?: string; output?: unknown };
type MessageLike = { role: string; parts: unknown[]; metadata?: unknown };

/** The panel of a finished presentOptions call, or null for anything else (a partial or malformed output). */
export function parseOptionsPanel(part: PartLike): OptionsPanel | null {
  if (part.type !== "tool-presentOptions" || part.state !== "output-available" || typeof part.toolCallId !== "string") return null;
  const o = part.output as Partial<OptionsPanel> & { shown?: unknown } | null;
  if (!o || o.shown !== true || typeof o.question !== "string" || !Array.isArray(o.options)) return null;
  const options = o.options.flatMap((x) => {
    const r = x as { id?: unknown; label?: unknown; explainer?: unknown };
    return typeof r.id === "string" && typeof r.label === "string" && typeof r.explainer === "string" ? [{ id: r.id, label: r.label, explainer: r.explainer }] : [];
  });
  if (options.length < 2) return null;
  return {
    pickerToolCallId: part.toolCallId,
    preamble: typeof o.preamble === "string" && o.preamble ? o.preamble : null,
    question: o.question,
    options,
    recommendedOptionId: typeof o.recommendedOptionId === "string" ? o.recommendedOptionId : null,
    allowFreeInput: o.allowFreeInput !== false,
    freeInputPlaceholder: typeof o.freeInputPlaceholder === "string" && o.freeInputPlaceholder ? o.freeInputPlaceholder : "Or tell me something else…",
  };
}

const textOf = (m: MessageLike) => m.parts.map((p) => ((p as { type?: string; text?: string }).type === "text" ? (p as { text?: string }).text ?? "" : "")).join("").trim();

/**
 * The panels in `messages[index]` and, for each, the user's answer: the label of the picked option, or their own
 * words when they typed instead. Null while nobody has replied after the message.
 */
export function panelsOf(messages: MessageLike[], index: number): { panel: OptionsPanel; answer: string | null }[] {
  type Row = { panel: OptionsPanel; answer: string | null };
  const message = messages[index];
  if (!message || message.role !== "assistant") return [];
  const reply = messages.slice(index + 1).find((m) => m.role === "user");
  const pick = (reply?.metadata as { optionPick?: { pickerToolCallId?: string; optionId?: string } } | undefined)?.optionPick;
  return (message.parts as PartLike[]).flatMap((p): Row[] => {
    const panel = parseOptionsPanel(p);
    if (!panel) return [];
    if (!reply) return [{ panel, answer: null }];
    const picked = pick?.pickerToolCallId === panel.pickerToolCallId ? panel.options.find((o) => o.id === pick.optionId) : undefined;
    return [{ panel, answer: picked?.label ?? textOf(reply) }];
  });
}

/** The panel still waiting for an answer: the newest message's, when no user message follows it. */
export function openPanelOf(messages: MessageLike[]): OptionsPanel | null {
  const last = messages.length - 1;
  const found = panelsOf(messages, last).filter((x) => x.answer === null);
  return found.at(-1)?.panel ?? null;
}
