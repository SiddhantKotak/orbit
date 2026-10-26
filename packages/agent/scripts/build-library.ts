/**
 * Offline library build. Real run (paid, controller only):
 *   pnpm --filter @brandloop/agent exec tsx --env-file-if-exists=../../.env scripts/build-library.ts --csv <path> --out data/templates.json --max-usd 5
 * `--dry-run` swaps in a scripted client and makes no network calls. `--limit N` caps clusters (smoke runs).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createAiClient, createEmbedder, type AiClient } from "@brandloop/ai";
import { buildLibrary, clusterByEmbedding, embeddingCostUsd, rowsFromCsv, type RefRow } from "../src/library/build";
import { presetStyles } from "../src/library/presets";

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const flag = (name: string) => process.argv.includes(`--${name}`);

/** Scripted stand-in: derives an unrelated draft from the cluster's position, never touching the network. */
function scriptedClient(): AiClient {
  let n = 0;
  return {
    async json({ schema }) {
      n++;
      return schema.parse({
        title: `Sample formula ${n}`,
        skeleton: `[Opening claim ${n}]\n\n[One supporting detail]\n\n[Closing line]`,
        beats: ["Claim", "Support", "Close"],
        why: "A clear order lets the reader follow without effort.",
        needs: n % 3 === 0 ? ["story"] : [],
        tags: ["sample", "dry-run"],
      });
    },
    async text() {
      return "";
    },
  };
}

/** Offline stand-in embedder: hashed bag-of-words vectors, so reworded duplicates still land close together. */
function hashedEmbed(texts: string[]): Promise<number[][]> {
  return Promise.resolve(
    texts.map((t) => {
      const v = new Array<number>(256).fill(0);
      for (const w of t.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []) {
        let h = 5381;
        for (const c of w) h = (h * 33 + c.codePointAt(0)!) >>> 0;
        v[h % 256]! += 1;
      }
      return v;
    }),
  );
}

async function main() {
  const csv = arg("csv");
  if (!csv) throw new Error("--csv <path> is required");
  const out = arg("out") ?? "data/templates.json";
  const presetsOut = arg("presets-out") ?? out.replace(/[^/]*$/, "preset-styles.json");
  const dry = flag("dry-run");
  const maxUsd = Number(arg("max-usd") ?? 5);
  const limit = arg("limit") ? Number(arg("limit")) : undefined;

  const target = Number(arg("target") ?? 300);
  const rows: RefRow[] = rowsFromCsv(readFileSync(csv, "utf8"));
  const embedUsd = dry ? 0 : embeddingCostUsd(rows.map((r) => r.content));
  const embedder = dry ? hashedEmbed : (t: string[]) => createEmbedder().embed(t);
  let clusters = await clusterByEmbedding(rows, embedder, target);
  console.log(`${rows.length} usable rows -> ${clusters.length} clusters (target ${target}); embeddings ~$${embedUsd.toFixed(4)}${dry ? " (dry run)" : ""}`);
  const per = new Map<string, number>();
  for (const c of clusters) per.set(`${c[0]!.type.toLowerCase()}/${c[0]!.category.toLowerCase()}`, (per.get(`${c[0]!.type.toLowerCase()}/${c[0]!.category.toLowerCase()}`) ?? 0) + 1);
  for (const [k, n] of [...per].sort()) console.log(`  ${k}: ${n}`);
  if (limit) clusters = clusters.slice(0, limit);

  const ai = dry ? scriptedClient() : createAiClient();
  const { templates, dropped, usd } = await buildLibrary({
    rows: [],
    clusters,
    baseUsd: embedUsd,
    ai,
    maxUsd,
    concurrency: dry ? 1 : 6,
    onProgress: (p) => process.stdout.write(`\r${p.done}/${p.total} kept ${p.kept} dropped ${p.dropped} ~$${p.usd.toFixed(2)}   `),
  });
  console.log();
  writeFileSync(out, `${JSON.stringify(templates, null, 2)}\n`);
  writeFileSync(presetsOut, `${JSON.stringify(presetStyles(), null, 2)}\n`);
  console.log(`wrote ${templates.length} templates to ${out}, ${presetStyles().length} presets to ${presetsOut}; dropped ${dropped}; est. $${usd.toFixed(2)}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
