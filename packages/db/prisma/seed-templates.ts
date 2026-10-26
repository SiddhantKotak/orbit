/**
 * Seeds the shipped template library (packages/agent/data/templates.json) as system rows. Idempotent by slug.
 *
 * Usage:  pnpm --filter @brandloop/db exec tsx prisma/seed-templates.ts          (database in DATABASE_URL)
 *         pnpm --filter @brandloop/db exec tsx prisma/seed-templates.ts --test   (the isolated test database only)
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "node:process";
import { databaseNameFromUrl, rootEnvFile } from "../src/test-db";
import type { SeedTemplate } from "../src/services/templates";

const here = path.dirname(fileURLToPath(import.meta.url));
const envFile = rootEnvFile(here);
if (envFile) {
  try {
    loadEnvFile(envFile);
  } catch {
    /* env may come from the shell */
  }
}
if (process.argv.includes("--test")) {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !databaseNameFromUrl(url)?.endsWith("_test")) throw new Error("TEST_DATABASE_URL must be set and name a database ending in _test.");
  process.env.DATABASE_URL = url;
}

const { upsertSystemTemplates } = await import("../src/services/templates");
const { prisma } = await import("../src/client");
const rows = JSON.parse(readFileSync(path.join(here, "../../agent/data/templates.json"), "utf8")) as SeedTemplate[];
const n = await upsertSystemTemplates(rows);
console.log(`Seeded ${n} templates into ${databaseNameFromUrl(process.env.DATABASE_URL ?? "") ?? "the database"}.`);
await prisma.$disconnect();
