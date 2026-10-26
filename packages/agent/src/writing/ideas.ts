/**
 * Post ideas with assigned sources (design §3, plan W11). The server decides what each idea is built from BEFORE any
 * model writes it, so a set draws on different material (a knowledge item, a story, a pillar, this week's research)
 * instead of reusing one client case three times. Pure: shared by the chat step and the Ideas screen.
 */

export type IdeaSourceKind = "knowledge" | "story" | "pillar" | "research";
export type IdeaSource = { kind: IdeaSourceKind; ref: string };
export type SlotSource = { slot: number; source: IdeaSource };

export type ResearchLike = { id: string; claim: string };

export type AssignInput = {
  count: number;
  knowledge: { id: string; title: string }[];
  stories: string[];
  pillars: string[];
  research: ResearchLike[];
  recentTitles: string[];
};

/** Kinds in the order they are dealt, most personal first. */
const KIND_ORDER: IdeaSourceKind[] = ["knowledge", "story", "research", "pillar"];

const tokens = (s: string) => new Set(s.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? []);

/** Whether an existing post already covers this source's text (so it goes to the back of its kind's queue). */
function recentlyCovered(text: string, recent: Set<string>[]): boolean {
  const t = tokens(text);
  if (t.size === 0) return false;
  return recent.some((r) => [...t].filter((w) => r.has(w)).length / t.size >= 0.6);
}

/**
 * One source per slot. Kinds are dealt round-robin (knowledge, story, research, pillar), so any set of 3 or more draws on at
 * least 3 kinds when that many exist. A source is used at most once while an unused one exists; only when every source is
 * spent does the least-used one repeat. Sources an earlier post already covers go last in their kind. Deterministic.
 */
export function assignSources(input: AssignInput): SlotSource[] {
  const recent = input.recentTitles.map(tokens);
  const queue = (items: { ref: string; text: string }[]): string[] => {
    const seen = new Set<string>();
    const unique = items.filter((i) => i.ref.trim() && !seen.has(i.ref) && seen.add(i.ref));
    return [...unique.filter((i) => !recentlyCovered(i.text, recent)), ...unique.filter((i) => recentlyCovered(i.text, recent))].map((i) => i.ref);
  };
  const pools: Record<IdeaSourceKind, string[]> = {
    knowledge: queue(input.knowledge.map((k) => ({ ref: k.id, text: k.title }))),
    story: queue(input.stories.map((s) => ({ ref: s, text: s }))),
    research: queue(input.research.map((r) => ({ ref: r.id, text: r.claim }))),
    pillar: queue(input.pillars.map((p) => ({ ref: p, text: p }))),
  };
  const kinds = KIND_ORDER.filter((k) => pools[k].length > 0);
  if (kinds.length === 0 || input.count <= 0) return [];
  const used = new Map<string, number>();
  const out: SlotSource[] = [];
  const next = { i: 0 };
  for (let slot = 1; slot <= input.count; slot++) {
    // Prefer the next kind in the deal that still has an unused source; if everything is spent, reuse the least-used.
    let pick: IdeaSource | null = null;
    for (let step = 0; step < kinds.length && !pick; step++) {
      const kind = kinds[(next.i + step) % kinds.length]!;
      const ref = pools[kind].find((r) => !used.has(`${kind}:${r}`));
      if (ref !== undefined) {
        pick = { kind, ref };
        next.i = (next.i + step + 1) % kinds.length;
      }
    }
    if (!pick) {
      const kind = kinds[next.i % kinds.length]!;
      const ref = [...pools[kind]].sort((a, b) => (used.get(`${kind}:${a}`) ?? 0) - (used.get(`${kind}:${b}`) ?? 0))[0]!;
      pick = { kind, ref };
      next.i = (next.i + 1) % kinds.length;
    }
    used.set(`${pick.kind}:${pick.ref}`, (used.get(`${pick.kind}:${pick.ref}`) ?? 0) + 1);
    out.push({ slot, source: pick });
  }
  return out;
}

/** The short badge shown on an idea: where it comes from. */
export function sourceBadge(source: IdeaSource): string {
  switch (source.kind) {
    case "knowledge":
      return "From your knowledge base";
    case "story":
      return "From your story";
    case "research":
      return "From this week's research";
    case "pillar":
      return `Pillar: ${source.ref.replace(/\s+/g, " ").trim().slice(0, 40)}`;
  }
}

/** A request for post ideas or a weekly plan: handled by the ideas step, and not a request for news. */
export function isIdeasRequest(text: string): boolean {
  return /\b(?:post|content|linkedin) ideas?\b|\bideas? for (?:this|next|the) (?:week|month)\b|\bwhat should i (?:post|write)\b|\bideas? for (?:my )?(?:posts?|linkedin)\b|\bgive me (?:\w+ ){0,2}ideas?\b/i.test(text);
}
