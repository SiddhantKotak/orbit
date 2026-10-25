import type { AiClient } from "@brandloop/ai";
import { DAILY_SEARCH_CAP, findFreshBrief, saveResearchBrief, searchesToday } from "@brandloop/db";
import { normalizeResearch, type Exclusion, type ResearchItem } from "./normalize";
import type { ResearchProvider, SearchResult } from "./provider";
import { windowWords, type ResearchWindow } from "./window";

export const PREFETCH_QUERIES = 3;
export const SEARCH_TIMEOUT_MS = 20_000;
export const PREFETCH_WALL_MS = 25_000;
/** Characters of the brief the writer and the orchestrator see (design §6.2). */
export const BRIEF_CHARS = { writer: 4_000, orchestrator: 2_500 } as const;
export const LIMIT_REFUSED = "Refused: today's research limit is reached.";

export type ResearchBrief = {
  window: ResearchWindow;
  topic: string;
  provider: string;
  items: ResearchItem[];
  exclusions: Exclusion[];
  searchCount: number;
  reused: boolean;
};

/** Our own freshness contract, put in every query (design §6.1). */
const contract = (w: ResearchWindow) =>
  `Only use sources published between ${windowWords(w)}. A roundup counts only for news inside that period. Give the exact publication date and the event date of each item, name the original source, and say plainly if nothing qualified.`;

/**
 * Three facet queries, built from the strategy and not from the chat's wording: official announcements on the topic,
 * the same for the user's audience and pillars, and data or reports.
 */
export function buildFacetQueries(topic: string, w: ResearchWindow, strategy: { audience: string | null; pillars: string[] }): string[] {
  const audience = strategy.audience?.trim();
  const pillars = strategy.pillars.map((p) => p.trim()).filter(Boolean).slice(0, 3).join(", ");
  const period = windowWords(w);
  return [
    `Official announcements about ${topic} during ${period}. ${contract(w)}`,
    `What changed during ${period} that matters for ${[audience, pillars].filter(Boolean).join("; ") || topic}. ${contract(w)}`,
    `New data, reports or studies about ${topic} published during ${period}. ${contract(w)}`,
  ];
}

export type PrefetchDeps = {
  ai: AiClient;
  provider: ResearchProvider;
  profileId: string;
  chatId: string;
  strategy: { audience: string | null; pillars: string[] };
  signal?: AbortSignal;
  now?: () => Date;
};

/**
 * Searches in parallel (three facets, 20 s each, 25 s in all), normalises, stores the brief and returns it. A fresh brief for
 * the same chat, window and topic is reused without a search; the per-profile daily cap returns the refusal text.
 */
export async function runResearch(deps: PrefetchDeps, topic: string, window: ResearchWindow): Promise<ResearchBrief | string> {
  const now = deps.now?.() ?? new Date();
  const fresh = await findFreshBrief(deps.profileId, deps.chatId, { topic, windowStart: window.start, windowEnd: window.end }, now);
  if (fresh) {
    return { window, topic, provider: fresh.provider, items: fresh.items as ResearchItem[], exclusions: fresh.exclusions as Exclusion[], searchCount: 0, reused: true };
  }
  if ((await searchesToday(deps.profileId, now)) + PREFETCH_QUERIES > DAILY_SEARCH_CAP) return LIMIT_REFUSED;

  const wall = AbortSignal.any([AbortSignal.timeout(PREFETCH_WALL_MS), ...(deps.signal ? [deps.signal] : [])]);
  const queries = buildFacetQueries(topic, window, deps.strategy);
  const settled = await Promise.allSettled(
    queries.map((query) => deps.provider.search({ query, window, maxResults: 8 }, AbortSignal.any([AbortSignal.timeout(SEARCH_TIMEOUT_MS), wall]))),
  );
  deps.signal?.throwIfAborted();
  const raw = settled.flatMap((s): SearchResult[] => (s.status === "fulfilled" ? [s.value] : []));
  const searchCount = settled.length;
  if (raw.length === 0) {
    await saveResearchBrief(deps.profileId, deps.chatId, { topic, windowStart: window.start, windowEnd: window.end, provider: deps.provider.id, items: [], exclusions: [], searchCount });
    return "Failed: the research providers did not answer in time. Try again in a moment.";
  }
  const { items, exclusions, dropped } = await normalizeResearch(deps.ai, raw, window, wall);
  if (dropped > 0) console.info(`[agent] research: dropped ${dropped} item(s) whose URL the provider never returned`);
  await saveResearchBrief(deps.profileId, deps.chatId, { topic, windowStart: window.start, windowEnd: window.end, provider: deps.provider.id, items, exclusions, searchCount });
  return { window, topic, provider: deps.provider.id, items, exclusions, searchCount, reused: false };
}

const d = (ymd: string | null) => (ymd ? `${Number(ymd.slice(8, 10))} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(ymd.slice(5, 7)) - 1]}` : "undated");

/** The brief as the `<research>` block of a prompt: items with ids and dates, then what was excluded, within the character budget. */
export function renderBrief(b: Pick<ResearchBrief, "window" | "items" | "exclusions">, max: number): string {
  const lines = [`Window: ${b.window.label} (${b.window.start} to ${b.window.end}). Use only these items; cite them by id. Name dates inline.`];
  for (const i of b.items) lines.push(`- ${i.id} [${d(i.eventDate ?? i.published)}] ${i.claim} (${i.publisher}, ${i.role})`);
  if (b.items.length === 0) lines.push("- No item qualified inside the window. Say so; do not state current events.");
  if (b.exclusions.length) lines.push(`Excluded: ${b.exclusions.map((e) => `${e.claim.slice(0, 80)} (${e.reason})`).join("; ")}`);
  const text = lines.join("\n");
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}
