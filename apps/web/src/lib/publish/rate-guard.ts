import { createHash } from "node:crypto";
import type { CounterStore } from "@brandloop/ai";

export const PUBLISH_LIMITS = {
  minGapMs: 60_000,
  dailyMax: 25,
  dayMs: 86_400_000,
  duplicateMs: 7 * 86_400_000,
} as const;

export type AllowResult = { ok: true } | { ok: false; reason: "too_soon" | "daily_limit"; retryAt: Date };
export type DuplicateResult = { ok: true } | { ok: false; reason: "duplicate"; lastAt: Date };

export type PublishGuard = {
  /** Pure check: at most 1 publish per 60 s and 25 per rolling 24 h for the profile. Writes nothing. */
  allow(profileId: string): Promise<AllowResult>;
  /** Records a successful publish for the rate window and the duplicate check. The only method that writes. */
  record(profileId: string, text: string): Promise<void>;
  /** Blocks the same normalised text (trim, collapsed whitespace, lowercase) for 7 days per profile. Writes nothing. */
  checkDuplicate(profileId: string, text: string): Promise<DuplicateResult>;
};

/** Trim, collapse whitespace runs, lowercase. */
export function normalizePostText(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

const hashText = (text: string) => createHash("sha256").update(normalizePostText(text)).digest("hex").slice(0, 32);

/**
 * Spam guard for publishing. Order of use: `checkDuplicate` -> `allow` -> publish -> `record`.
 * Only `record` writes, so a failed or refused publish never uses up quota. Counters are exact (a timestamped
 * event log per profile, a sorted set in Redis), keyed `pub:...` with the profile id; post text is only ever
 * stored as a hash and is never logged.
 */
export function createPublishGuard({ store, now = Date.now }: { store: CounterStore; now?: () => number }): PublishGuard {
  const rateKey = (profileId: string) => `pub:rate:${profileId}`;
  const dupKey = (profileId: string, text: string) => `pub:dup:${profileId}:${hashText(text)}`;
  const { minGapMs, dailyMax, dayMs, duplicateMs } = PUBLISH_LIMITS;

  return {
    async allow(profileId) {
      const t = now();
      const times = await store.events(rateKey(profileId), t - dayMs + 1);
      const last = times[times.length - 1];
      if (last !== undefined && t - last < minGapMs) return { ok: false, reason: "too_soon", retryAt: new Date(last + minGapMs) };
      if (times.length >= dailyMax) {
        // The next slot opens when enough of the oldest events leave the window to get under the cap.
        const oldestBlocking = times[times.length - dailyMax]!;
        return { ok: false, reason: "daily_limit", retryAt: new Date(oldestBlocking + dayMs) };
      }
      return { ok: true };
    },
    async record(profileId, text) {
      const t = now();
      await store.addEvent(rateKey(profileId), t, Math.ceil(dayMs / 1000) + 60);
      await store.addEvent(dupKey(profileId, text), t, Math.ceil(duplicateMs / 1000) + 60);
    },
    async checkDuplicate(profileId, text) {
      const t = now();
      const times = await store.events(dupKey(profileId, text), t - duplicateMs + 1);
      const last = times[times.length - 1];
      return last === undefined ? { ok: true } : { ok: false, reason: "duplicate", lastAt: new Date(last) };
    },
  };
}
