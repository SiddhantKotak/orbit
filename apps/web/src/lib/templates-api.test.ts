import { assertTestDatabase } from "@brandloop/db/test-db";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Real Postgres (the isolated test database, TEST_DATABASE_URL); only the account is faked.
const env = vi.hoisted(() => {
  try {
    process.loadEnvFile(new URL("../../../../.env", import.meta.url));
  } catch {
    /* DATABASE_URL may already be set */
  }
  return { account: null as null | { user: { id: string }; currentProfile: { id: string } | null } };
});
vi.mock("@/lib/account", () => ({ getAccount: async () => env.account }));

import { ensureAccount, prisma } from "@brandloop/db";
import { getTemplatesHandler, setSavedHandler } from "./templates-api";

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const CLERK = "user_webtest_templates";
let a: { userId: string; profileId: string };
let b: { userId: string; profileId: string };
const ownSlug = "webtest-own-template";

async function wipe() {
  const users = { clerkId: { startsWith: CLERK } };
  for (let attempt = 1; ; attempt++) {
    try {
      await assertTestDatabase(prisma);
      await prisma.template.deleteMany({ where: { slug: ownSlug } });
      await prisma.team.deleteMany({ where: { name: { endsWith: " (webtest)" }, memberships: { some: { user: users } } } });
      await prisma.user.deleteMany({ where: users });
      return;
    } catch (err) {
      if (attempt >= 4) throw err;
      await new Promise((r) => setTimeout(r, 250 * attempt));
    }
  }
}

const as = (p: { userId: string; profileId: string }) => (env.account = { user: { id: p.userId }, currentProfile: { id: p.profileId } });
const list = async (qs = "") => (await getTemplatesHandler(new Request(`http://t/api/templates${qs}`))).json() as Promise<{ total: number; items: { id: string; slug: string; type: string; category: string; title: string; saved: boolean }[] }>;

beforeAll(async () => {
  await wipe();
  const one = await ensureAccount({ clerkId: `${CLERK}1`, email: "webtpl1@example.test", firstName: "A", teamNameSuffix: " (webtest)" });
  const two = await ensureAccount({ clerkId: `${CLERK}2`, email: "webtpl2@example.test", firstName: "B", teamNameSuffix: " (webtest)" });
  a = { userId: one.user.id, profileId: one.currentProfile!.id };
  b = { userId: two.user.id, profileId: two.currentProfile!.id };
  await prisma.template.create({
    data: { slug: ownSlug, type: "POST", category: "curated", title: "Webtest own template", skeleton: "A\n\nB", beats: [], why: "mine", needs: [], tags: [], system: false, profileId: a.profileId },
  });
});
afterAll(wipe);
beforeEach(() => as(a));

describe("GET /api/templates", () => {
  it("filters by type and category, searches and pages", async () => {
    const posts = await list("?type=POST&limit=10");
    expect(posts.items).toHaveLength(10);
    expect(posts.items.every((t) => t.type === "POST")).toBe(true);
    const hooks = await list("?type=HOOK&limit=5");
    expect(hooks.items.every((t) => t.type === "HOOK")).toBe(true);

    const category = posts.items[0]!.category;
    const inCategory = await list(`?type=POST&category=${category}&limit=100`);
    expect(inCategory.items.length).toBeGreaterThan(0);
    expect(inCategory.items.every((t) => t.category === category)).toBe(true);

    const page1 = await list("?type=POST&limit=5&offset=0");
    const page2 = await list("?type=POST&limit=5&offset=5");
    expect(page1.total).toBe(page2.total);
    expect(page1.items.map((t) => t.slug)).not.toEqual(page2.items.map((t) => t.slug));

    const found = await list(`?search=${encodeURIComponent(posts.items[0]!.title.slice(0, 12))}`);
    expect(found.items.some((t) => t.slug === posts.items[0]!.slug)).toBe(true);
    expect((await list("?search=zzzqqqnomatch")).total).toBe(0);
  });

  it("shows the profile its own templates and nobody else's", async () => {
    expect((await list("?search=Webtest%20own")).items.map((t) => t.slug)).toEqual([ownSlug]);
    as(b);
    expect((await list("?search=Webtest%20own")).total).toBe(0);
  });
});

describe("PUT/DELETE /api/templates/:id/save", () => {
  it("saves, lists as saved, and unsaves", async () => {
    const first = (await list("?type=POST&limit=1")).items[0]!;
    expect(first.saved).toBe(false);
    expect((await setSavedHandler(first.id, true)).status).toBe(200);
    expect((await list("?type=POST&limit=1")).items[0]!.saved).toBe(true);
    const saved = await list("?saved=1");
    expect(saved.items.map((t) => t.id)).toEqual([first.id]);
    as(b);
    expect((await list("?saved=1")).total).toBe(0);
    as(a);
    expect((await setSavedHandler(first.id, false)).status).toBe(200);
    expect((await list("?saved=1")).total).toBe(0);
  });

  it("does not save another profile's template or an unknown one", async () => {
    const own = await prisma.template.findUniqueOrThrow({ where: { slug: ownSlug } });
    as(b);
    expect((await setSavedHandler(own.id, true)).status).toBe(404);
    expect((await setSavedHandler("nope", true)).status).toBe(404);
  });
});
