import { describe, expect, it } from "vitest";
import type { AiClient } from "@brandloop/ai";
import { STYLE_SCHEMA_VERSION } from "@brandloop/ai";
import { buildLibrary, clusterByEmbedding, clusterRows, ngramSimilarity, parseCsv, rowsFromCsv, type RefRow } from "./build";
import { presetStyles } from "./presets";

const row = (title: string, content: string, type = "hook", category = "educational"): RefRow => ({ title, type, category, description: "", content });

const draft = (n: number, skeleton?: string) => ({
  title: `Original take ${n}`,
  skeleton: skeleton ?? `[Lead ${n}] then [detail] and finally [wrap-up ${n}] in a fresh arrangement`,
  beats: ["Lead", "Detail"],
  why: "Order helps the reader follow along.",
  needs: [] as string[],
  tags: ["alpha", "beta"],
});

/** Scripted client: each call returns the next scripted reply (a function sees the prompt). */
function fake(replies: ((prompt: string) => unknown)[]): AiClient & { calls: number } {
  const c = {
    calls: 0,
    async json<T>({ schema, prompt }: { schema: { parse(v: unknown): T }; prompt: string }) {
      const r = replies[Math.min(c.calls, replies.length - 1)]!;
      c.calls++;
      return schema.parse(r(prompt));
    },
    async text() { return ""; },
  };
  return c as unknown as AiClient & { calls: number };
}

const SRC = "Most people think success needs luck but the truth is that steady habits compound over many quiet years";

describe("similarity and clustering", () => {
  it("ngramSimilarity is 1 for identical text and about 0 for unrelated", () => {
    expect(ngramSimilarity("a b c d e f", "a b c d e f")).toBe(1);
    expect(ngramSimilarity("one two three four five six seven", "red green blue black white pink gray")).toBe(0);
  });

  it("merges near-identical hooks and keeps distinct ones apart", () => {
    const rows = [
      row("A", "Here is the one habit that changed how I run every single morning meeting"),
      row("B", "Here is the one habit that changed how I run every single morning meeting today"),
      row("C", "Nobody tells you how lonely the first year of a startup really feels at night"),
      row("D", "Here is the one habit that changed how I run every single morning meeting", "post"),
    ];
    const clusters = clusterRows(rows);
    expect(clusters.map((c) => c.map((r) => r.title))).toEqual([["A", "B"], ["C"], ["D"]]);
  });
});

describe("buildLibrary", () => {
  it("regenerates a verbatim copy and keeps the clean retry", async () => {
    const ai = fake([() => draft(1, SRC), () => draft(2)]);
    const out = await buildLibrary({ rows: [row("Source Title", SRC)], ai, maxUsd: 5 });
    expect(ai.calls).toBe(2);
    expect(out.templates).toHaveLength(1);
    expect(out.dropped).toBe(0);
    expect(out.templates[0]!.skeleton).not.toContain("Most people");
  });

  it("drops a cluster after 2 retries", async () => {
    const ai = fake([() => draft(1, SRC)]);
    const out = await buildLibrary({ rows: [row("Source Title", SRC)], ai, maxUsd: 5 });
    expect(ai.calls).toBe(3);
    expect(out).toMatchObject({ templates: [], dropped: 1 });
  });

  it("rejects a draft that reuses a source title", async () => {
    const ai = fake([() => ({ ...draft(1), title: "Source Title" }), () => draft(2)]);
    const out = await buildLibrary({ rows: [row("Source Title", SRC)], ai, maxUsd: 5 });
    expect(out.templates[0]!.title).toBe("Original take 2");
  });

  it("stops when maxUsd is reached", async () => {
    const rows = Array.from({ length: 5 }, (_, i) => row(`T${i}`, `unique content number ${i} ${"filler ".repeat(40)}${i}${i}`, "post", `cat${i}`));
    const ai = fake([(p) => draft(p.length)]);
    const out = await buildLibrary({ rows, ai, maxUsd: 0.000001 });
    expect(out.templates).toHaveLength(1);
    expect(out.usd).toBeGreaterThan(0);
  });

  it("emits unique kebab-case slugs and never a source title", async () => {
    const rows = [row("Alpha Source", "first body of words here that stands alone entirely", "hook", "a"), row("Beta Source", "second body of different words that is wholly separate", "hook", "b")];
    const ai = fake([() => ({ ...draft(1), title: "Same Name!" })]);
    const out = await buildLibrary({ rows, ai, maxUsd: 5 });
    const slugs = out.templates.map((t) => t.slug);
    expect(slugs).toEqual(["same-name", "same-name-2"]);
    expect(slugs.every((s) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s))).toBe(true);
    const all = JSON.stringify(out.templates).toLowerCase();
    expect(all).not.toContain("alpha source");
    expect(all).not.toContain("beta source");
  });
});

describe("csv and presets", () => {
  it("parses quoted multi-line fields, escaped quotes and a BOM", () => {
    const text = '﻿title,type,category,description,content\r\nT1,hook,x,"d, with comma","line one\nline ""two"""\r\nT2,post,y,,body\r\nT3,video,y,,skip';
    const rows = parseCsv(text);
    expect(rows[0]!.content).toBe('line one\nline "two"');
    expect(rows).toHaveLength(3);
    expect(rowsFromCsv(text).map((r) => r.title)).toEqual(["T1", "T2"]);
  });

  it("ships 10 valid preset styles with 3 reference posts each", () => {
    const presets = presetStyles();
    expect(presets).toHaveLength(10);
    expect(new Set(presets.map((p) => p.slug)).size).toBe(10);
    for (const p of presets) {
      expect(p.profile.schemaVersion).toBe(STYLE_SCHEMA_VERSION);
      expect(p.profile.referencePosts).toHaveLength(3);
      expect(p.profile.source.kind).toBe("preset");
    }
  });
});

describe("clusterByEmbedding", () => {
  // Fake embedder: the first word picks the axis, so reworded rows sharing it are near-identical.
  const axes = ["alpha", "beta", "gamma", "delta"];
  const embed = async (texts: string[]) => texts.map((t, i) => [...axes.map((a) => (t.startsWith(a) ? 1 : 0)), i * 0.001]);
  const rows = [
    row("1", "alpha one worded this way", "hook", "x"),
    row("2", "alpha one phrased otherwise", "hook", "x"),
    row("3", "beta something else", "hook", "x"),
    row("4", "alpha one worded this way", "post", "x"),
    row("5", "alpha one worded this way", "hook", "y"),
    row("6", "gamma more", "hook", "y"),
  ];

  it("merges reworded rows and respects the target exactly", async () => {
    const out = await clusterByEmbedding(rows, embed, 5);
    expect(out).toHaveLength(5);
    expect(out.find((c) => c.length === 2)!.map((r) => r.title)).toEqual(["1", "2"]);
    expect(await clusterByEmbedding(rows, embed, 4)).toHaveLength(4);
  });

  it("never merges across type or category", async () => {
    const out = await clusterByEmbedding(rows, embed, 1);
    expect(out).toHaveLength(3);
    for (const c of out) expect(new Set(c.map((r) => `${r.type}|${r.category}`)).size).toBe(1);
  });
});
