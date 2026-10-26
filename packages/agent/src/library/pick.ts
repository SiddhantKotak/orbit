import type { TemplateRow } from "@brandloop/db";
import { hash } from "./index";

export type PickEvidence = { hasStory: boolean; numbers: string[]; hasNews: boolean };

export type PickInput = {
  candidates: TemplateRow[];
  /** The kind of post the picked angle asked for (a category id), or null. */
  category: string | null;
  evidence: PickEvidence;
  /** Template ids the profile used lately, newest first. */
  recent: string[];
  /** Per template: how lightly this profile edited its drafts (0..1). A template with no history is absent. */
  scores: Map<string, number>;
  /** Lowercase words from the user's content pillars and memory topics. */
  nicheTerms: string[];
  seed: string;
};

/** The inputs a template needs that the evidence does not hold, as the user would say them. */
export function missingNeeds(needs: string[], e: PickEvidence): string[] {
  const out: string[] = [];
  if (needs.includes("story") && !e.hasStory) out.push("a real story of theirs");
  if (needs.includes("number") && e.numbers.length === 0) out.push("a number or metric");
  if (needs.includes("news") && !e.hasNews) out.push("a recent event");
  return out;
}

const NEUTRAL = 0.5;
const MAX_TAG_POINTS = 2;

/**
 * Picks one template for a new post. Deterministic for a seed. Templates whose inputs the user has not supplied are
 * dropped; then category match (+3), niche tags (+1 each, up to +2) and the profile's own edit history (2 x score) rank
 * the rest. Templates used recently are skipped until every candidate is recent, and then the least recently used wins.
 */
export function pickTemplate(input: PickInput): TemplateRow | null {
  const eligible = input.candidates.filter((t) => missingNeeds(t.needs, input.evidence).length === 0);
  if (eligible.length === 0) return null;
  const recentIndex = new Map<string, number>();
  input.recent.forEach((id, i) => {
    if (!recentIndex.has(id)) recentIndex.set(id, i);
  });
  const fresh = eligible.filter((t) => !recentIndex.has(t.id));
  if (fresh.length === 0) {
    // Everything has been used lately: the one used longest ago (largest index) goes first.
    return [...eligible].sort((a, b) => recentIndex.get(b.id)! - recentIndex.get(a.id)! || hash(`${input.seed}:${a.id}`) - hash(`${input.seed}:${b.id}`))[0]!;
  }
  const niche = new Set(input.nicheTerms.map((t) => t.toLowerCase()));
  const score = (t: TemplateRow) => {
    const tags = new Set(t.tags.map((x) => x.toLowerCase()));
    let overlap = 0;
    for (const tag of tags) if (niche.has(tag)) overlap++;
    return (input.category && t.category === input.category ? 3 : 0) + Math.min(MAX_TAG_POINTS, overlap) + 2 * (input.scores.get(t.id) ?? NEUTRAL);
  };
  return fresh.map((t) => ({ t, s: score(t) })).sort((a, b) => b.s - a.s || hash(`${input.seed}:${a.t.id}`) - hash(`${input.seed}:${b.t.id}`))[0]!.t;
}
