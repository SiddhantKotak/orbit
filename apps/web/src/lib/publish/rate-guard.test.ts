import { describe, expect, it } from "vitest";
import { memoryStore } from "@brandloop/ai";
import { createPublishGuard } from "./rate-guard";

const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function setup() {
  let t = Date.UTC(2026, 0, 1);
  const now = () => t;
  const store = memoryStore(now);
  return { guard: createPublishGuard({ store, now }), store, advance: (ms: number) => (t += ms), at: () => t };
}

describe("publish guard: rate", () => {
  it("allows the first publish", async () => {
    expect(await setup().guard.allow("p1")).toEqual({ ok: true });
  });

  it("blocks a second publish within 60 s with the right retryAt", async () => {
    const { guard, advance, at } = setup();
    const start = at();
    await guard.record("p1", "a");
    advance(20_000);
    expect(await guard.allow("p1")).toEqual({ ok: false, reason: "too_soon", retryAt: new Date(start + MIN) });
    advance(40_000);
    expect(await guard.allow("p1")).toEqual({ ok: true });
  });

  it("stops the 26th publish in 24 h and reopens when the oldest drops out", async () => {
    const { guard, advance, at } = setup();
    const start = at();
    for (let i = 0; i < 25; i++) {
      expect(await guard.allow("p1")).toEqual({ ok: true });
      await guard.record("p1", `post ${i}`);
      advance(MIN);
    }
    const res = await guard.allow("p1");
    expect(res).toEqual({ ok: false, reason: "daily_limit", retryAt: new Date(start + DAY) });
  });

  it("slides: allowed again once the window passes", async () => {
    const { guard, advance, at } = setup();
    const start = at();
    for (let i = 0; i < 25; i++) {
      await guard.record("p1", `post ${i}`);
      advance(MIN);
    }
    expect((await guard.allow("p1")).ok).toBe(false);
    advance(start + DAY - at());
    expect(await guard.allow("p1")).toEqual({ ok: true });
  });

  it("keeps profiles independent", async () => {
    const { guard } = setup();
    await guard.record("p1", "a");
    expect((await guard.allow("p1")).ok).toBe(false);
    expect(await guard.allow("p2")).toEqual({ ok: true });
    expect(await guard.checkDuplicate("p2", "a")).toEqual({ ok: true });
  });

  it("allow has no side effects", async () => {
    const { guard } = setup();
    for (let i = 0; i < 40; i++) expect(await guard.allow("p1")).toEqual({ ok: true });
    await guard.checkDuplicate("p1", "x");
    expect(await guard.checkDuplicate("p1", "x")).toEqual({ ok: true });
  });
});

describe("publish guard: duplicates", () => {
  it("blocks the same text ignoring whitespace and case, for 7 days", async () => {
    const { guard, advance, at } = setup();
    const start = at();
    await guard.record("p1", "Hello   World\n");
    advance(6 * DAY);
    expect(await guard.checkDuplicate("p1", "  hello world ")).toEqual({ ok: false, reason: "duplicate", lastAt: new Date(start) });
    advance(DAY);
    expect(await guard.checkDuplicate("p1", "hello world")).toEqual({ ok: true });
  });

  it("allows different text", async () => {
    const { guard } = setup();
    await guard.record("p1", "hello world");
    expect(await guard.checkDuplicate("p1", "hello there")).toEqual({ ok: true });
  });

  it("never stores post text in keys", async () => {
    const keys: string[] = [];
    const base = memoryStore();
    const store = { ...base, addEvent: (k: string, a: number, t: number) => (keys.push(k), base.addEvent(k, a, t)) };
    await createPublishGuard({ store }).record("p1", "secret launch plan");
    expect(keys.every((k) => k.startsWith("pub:") && k.includes("p1") && !k.includes("secret"))).toBe(true);
  });
});
