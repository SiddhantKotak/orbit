import type { StyleProfile } from "@brandloop/ai/style";

export type CorpusExample = { text: string; source: "ORBIT" | "EXPORT" | "PASTE" | string; postedAt: Date | null };

const SOURCE_RANK: Record<string, number> = { ORBIT: 0, EXPORT: 1, PASTE: 2 };
const rank = (s: string) => SOURCE_RANK[s] ?? 3;

/**
 * Up to `n` of the user's own posts for the writer to imitate: posts inside the style's post-length range first, then by
 * source (published through Orbit, then exported, then pasted), newest first.
 */
export function pickExamplePosts(corpus: CorpusExample[], style: StyleProfile | null, n = 3): string[] {
  const range = style?.layout.postChars;
  const inRange = (t: string) => !range || (t.length >= range.low && t.length <= range.high);
  return corpus
    .filter((p) => p.text.trim())
    .map((p) => ({ p, ok: inRange(p.text) }))
    .sort(
      (a, b) =>
        Number(b.ok) - Number(a.ok) ||
        rank(a.p.source) - rank(b.p.source) ||
        (b.p.postedAt?.getTime() ?? 0) - (a.p.postedAt?.getTime() ?? 0),
    )
    .slice(0, Math.min(n, 3))
    .map((x) => x.p.text.trim());
}
