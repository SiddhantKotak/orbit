import { execFileSync } from "node:child_process";
import { clerk } from "@clerk/testing/playwright";
import { expect, test, type Page } from "@playwright/test";
import { resolveTestDatabaseUrl } from "../../../packages/db/src/test-db";

/**
 * Writing engine W11: "post ideas" is its own step. The server gives every idea a different piece of the user's material
 * (knowledge item, story, strategy pillar) before anything is written, and the turn ends on a picker: 5 ideas, each with a
 * source badge. Picking one writes the post at once. A task framing ("skip personal details ...") teaches memory nothing.
 * Kleo evidence: L13, A7/WQ §5, EV (b), Q1. Mock model.
 */
const email = process.env.E2E_CLERK_USER_EMAIL;
const mock = process.env.AI_MOCK_MODEL === "1";
test.skip(!email, "Set E2E_CLERK_USER_EMAIL to a Clerk dev-instance test user");
test.skip(!mock, "Needs AI_MOCK_MODEL=1: the chat runs against the scripted mock model");
test.setTimeout(150_000);

const CHAT_URL = /\/chat\/([0-9a-f-]{36})$/;
const created = new Set<string>();
const items: string[] = [];

async function memoryVersion(page: Page): Promise<number> {
  return ((await (await page.request.get("/api/user-memory")).json()) as { version: number }).version;
}

test.beforeEach(async ({ page }) => {
  page.on("request", (req) => {
    if (req.method() !== "POST" || new URL(req.url()).pathname !== "/api/chat") return;
    const id = (req.postDataJSON() as { id?: string } | null)?.id;
    if (id) created.add(id);
  });
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: email! });
  await page.goto("/");
  // The user's own material: two knowledge items, a story in memory and a strategy (the isolated test database).
  const body = (lead: string) => `${lead} ${"The team wrote down what happened, what they changed and what they would keep. ".repeat(10)}`;
  for (const [title, content] of [["Client onboarding teardown", body("We cut onboarding from nine steps to four.")], ["Pricing page experiment", body("A flat price beat tiers in our test.")]]) {
    const res = await page.request.post("/api/knowledge-base", { data: { type: "TEXT", title, content } });
    items.push(((await res.json()) as { item: { id: string } }).item.id);
  }
  await page.request.patch("/api/user-memory", {
    data: { target: "identity/story", content: "- Lost a client by overpromising a deadline in year one\n- Hired a designer before an engineer", expectedVersion: await memoryVersion(page) },
  });
  execFileSync("pnpm", ["--filter", "@brandloop/db", "exec", "tsx", "prisma/dev-seed-strategy.ts", email!], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: resolveTestDatabaseUrl() },
  });
});
test.afterEach(async ({ page }) => {
  for (const id of created) await page.request.delete(`/api/chat/${id}`).catch(() => {});
  created.clear();
  for (const id of items.splice(0)) await page.request.delete(`/api/knowledge-base/${id}`).catch(() => {});
  await page.request.patch("/api/user-memory", { data: { target: "identity/story", content: null, expectedVersion: await memoryVersion(page) } }).catch(() => {});
});

test("ideas end on a picker with different sources; picking idea 2 writes the post", async ({ page }) => {
  const box = page.getByLabel("Message", { exact: true });
  await box.fill("Give me 5 post ideas for this week");
  await box.press("Enter");
  await expect(page).toHaveURL(CHAT_URL, { timeout: 30_000 });

  const panel = page.locator("[data-options-panel]");
  await expect(panel).toBeVisible({ timeout: 30_000 });
  await expect(panel.getByRole("heading")).toContainText("Which idea should we develop first?");
  const rows = panel.locator("[data-option]");
  await expect(rows).toHaveCount(5);
  const badges = await panel.locator("[data-option-badge]").allTextContents();
  expect(badges).toHaveLength(5);
  expect(new Set(badges).size).toBeGreaterThanOrEqual(3);
  expect(badges.some((b) => b === "From your knowledge base")).toBe(true);
  expect(badges.some((b) => b === "From your story")).toBe(true);
  await expect(panel.locator("[data-suggested]")).toHaveCount(1);
  await expect(page.locator("[data-draft-card]")).toHaveCount(0);
  // The briefs stay on the server side of the screen.
  await expect(page.locator("body")).not.toContainText("Invent no personal facts");

  const second = rows.nth(1);
  const label = ((await second.locator("[data-option-label]").textContent()) ?? "").replace("Suggested", "").trim();
  await second.click();
  await expect(page.locator('[data-message="user"]').last()).toContainText(label);
  await expect(page.getByRole("dialog", { name: "MVP versus POC" }).locator("[data-post-text]")).toContainText("Build the POC in a week", { timeout: 40_000 });
  await expect(page.locator("[data-draft-card]")).toHaveCount(1);
  await expect(page.locator("[data-options-summary]")).toContainText(`A: ${label}`);
});

test("a task framing teaches memory nothing", async ({ page }) => {
  const before = await memoryVersion(page);
  const box = page.getByLabel("Message", { exact: true });
  await box.fill("Skip personal details. Write it as practical lessons for founders hiring their first engineer");
  await box.press("Enter");
  await expect(page).toHaveURL(CHAT_URL, { timeout: 30_000 });
  // The mock model tries to save "Has hired their first engineer"; the server refuses, and the turn finishes.
  await expect(page.locator('[data-message="assistant"]').last()).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1_500);
  expect(await memoryVersion(page)).toBe(before);
  const memory = JSON.stringify(await (await page.request.get("/api/user-memory")).json());
  expect(memory).not.toContain("hired their first engineer");
});
