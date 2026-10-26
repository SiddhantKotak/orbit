/** Text patterns shared by the final review's checks (specialists/checks.ts) and the validator (writing/lint.ts). */

export const PLACEHOLDER = /\[[^\]\n]{1,60}\]|\{[^}\n]{1,60}\}|\bTODO\b|\bXXX\b/g;
export const MARKDOWN = /\*\*|__(?=[^\s_])[^\n]*?[^\s_]__|^\s{0,3}#{1,6}\s|^\s*```|^\s*~~~/gm;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function bannedMatches(text: string, words: string[]): string[] {
  const hits: string[] = [];
  for (const raw of words) {
    const word = raw.trim();
    if (!word) continue;
    const re = new RegExp(`(?<![\\p{L}\\p{N}_])${escape(word).replace(/\s+/g, "\\s+")}(?![\\p{L}\\p{N}_])`, "iu");
    if (re.test(text)) hits.push(word);
  }
  return hits;
}


const HEADING = /^\s{0,3}#{1,6}\s+(.*)$/;
const BULLET = /^\s*[-*+]\s+(.+?)\s*$/;

/** Bullets (comma-separated lists split) under any heading containing "banned" (case-insensitive), up to the next heading. */
export function bannedWordsFromRules(markdown: string): string[] {
  const words: string[] = [];
  let inBanned = false;
  for (const line of markdown.split("\n")) {
    const heading = HEADING.exec(line);
    if (heading) {
      inBanned = /banned/i.test(heading[1]!);
      continue;
    }
    if (!inBanned) continue;
    const bullet = BULLET.exec(line);
    if (!bullet) continue;
    for (const part of bullet[1]!.split(",")) {
      const word = part.trim().replace(/^["'`“‘]+|["'`”’]+$/g, "").trim();
      if (word && !words.includes(word)) words.push(word);
    }
  }
  return words;
}

export type AiTell = { id: "not-just" | "triad" | "filler" | "overused" | "uniform-rhythm"; detail: string };

const OVERUSED = [
  /\bdelv(?:e|es|ed|ing)\b/i, /\btapestry\b/i, /\blandscape\b/i, /\bgame[- ]changers?\b/i, /\bunlock(?:s|ed|ing)?\b/i, /\belevat(?:e|es|ed|ing)\b/i,
  /\b(?:to|we|i|they|can|will|could|should)\s+leverage\b|\bleverag(?:es|ed|ing)\b/i, /\bseamless(?:ly)?\b/i, /\brobust\b/i, /\bpivotal\b/i,
];
const FILLER = [/in today'?s fast[- ]paced/i, /let'?s dive in/i, /here'?s the kicker/i, /the best part\?/i];
const NOT_JUST = /\bnot (?:just|only) [^.]{1,60}(?:,)? but\b/i;
const NOT_X_ITS_Y = /\b(?:it|this|that)(?:'s| is) not [^.!?\n]{1,60}[.!?]\s+(?:it|this|that)(?:'s| is)\b/i;
const TRIAD = /[^,.;:!?\n]+,[^,.;:!?\n]+,\s*(?:and|or)\s+[^,.;:!?\n]+/i;

const sentencesOf = (text: string) => text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter((s) => /\p{L}/u.test(s));

/** Common tells of machine-written prose. Heuristics: used as target-level findings, never as blockers. */
export function aiTells(text: string): AiTell[] {
  const out: AiTell[] = [];
  const over = OVERUSED.map((re) => re.exec(text)?.[0].trim().toLowerCase()).filter((x): x is string => !!x);
  if (over.length) out.push({ id: "overused", detail: `Overused words: ${[...new Set(over)].join(", ")}` });
  const filler = FILLER.map((re) => re.exec(text)?.[0]).filter((x): x is string => !!x);
  if (filler.length) out.push({ id: "filler", detail: `Stock phrases: ${filler.join(", ")}` });
  if (NOT_JUST.test(text) || NOT_X_ITS_Y.test(text)) out.push({ id: "not-just", detail: "A \"not just X, but Y\" or \"It's not X. It's Y.\" construction" });
  const sentences = sentencesOf(text);
  const triads = sentences.filter((s) => TRIAD.test(s)).length;
  if (triads >= 2) out.push({ id: "triad", detail: `${triads} sentences list three things ("A, B, and C")` });
  if (sentences.length >= 6) {
    const words = sentences.map((s) => s.split(/\s+/).length);
    const mean = words.reduce((a, b) => a + b, 0) / words.length;
    const sd = Math.sqrt(words.reduce((a, b) => a + (b - mean) ** 2, 0) / words.length);
    if (mean > 0 && sd / mean < 0.25) out.push({ id: "uniform-rhythm", detail: "Every sentence is about the same length; vary the rhythm" });
  }
  return out;
}
