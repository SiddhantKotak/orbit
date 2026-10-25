import { clerk } from "@clerk/testing/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Free version switching in the post editor: pick any version in the menu and it is current at once, editable, with
 * no preview bar, Restore button or toast, and switching back and forth never adds a version.
 */
const email = process.env.E2E_CLERK_USER_EMAIL;
test.skip(!email, "Set E2E_CLERK_USER_EMAIL to a Clerk dev-instance test user");
test.skip(process.env.AI_MOCK_MODEL !== "1", "Needs AI_MOCK_MODEL=1");
test.setTimeout(180_000);

const CHAT_URL = /\/chat\/([0-9a-f-]{36})$/;
const created = new Set<string>();

test.beforeEach(async ({ page }) => {
  page.on("request", (req) => {
    if (req.method() !== "POST" || new URL(req.url()).pathname !== "/api/chat") return;
    const id = (req.postDataJSON() as { id?: string } | null)?.id;
    if (id) created.add(id);
  });
});
test.afterEach(async ({ page }) => {
  for (const id of created) await page.request.delete(`/api/chat/${id}`).catch(() => {});
  created.clear();
});

async function startChat(page: Page, text: string): Promise<string> {
  await page.goto("/");
  const box = page.getByLabel("Message", { exact: true });
  await box.fill(text);
  await box.press("Enter");
  await expect(page).toHaveURL(CHAT_URL, { timeout: 30_000 });
  return CHAT_URL.exec(page.url())![1]!;
}

test("switching versions in the editor is free: editable, no restore, no new versions", async ({ page }) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: email! });
  const chatId = await startChat(page, "Draft a short LinkedIn post about pricing");
  let postId = "";
  await expect(async () => {
    const res = await page.request.get(`/api/chat/${chatId}/messages`);
    postId = ((await res.json()) as { document?: { id: string } | null }).document?.id ?? "";
    expect(postId).not.toBe("");
  }).toPass({ timeout: 60_000 });

  // A second version through the API.
  let doc = (await (await page.request.get(`/api/documents/${postId}`)).json()) as { text: string; version: number };
  const v1Text = doc.text;
  const patched = await page.request.patch(`/api/documents/${postId}`, { data: { text: "Second version, totally different.", expectedVersion: doc.version } });
  expect(patched.status()).toBe(200);
  const versionCount = async () => ((await (await page.request.get(`/api/documents/${postId}/versions`)).json()) as { versions: unknown[] }).versions.length;
  expect(await versionCount()).toBe(2);

  await page.goto(`/posts/${postId}`);
  const editor = page.locator(".ProseMirror");
  const label = page.locator("[data-version-label]");
  await expect(label).toContainText("Version 2");
  await expect(editor).toContainText("Second version");

  // To v1: its content, editable, nothing about previews or restores.
  await label.click();
  await page.getByRole("button", { name: "Switch to version 1" }).click();
  await expect(label).toContainText("Version 1");
  await expect(editor).toContainText(v1Text.slice(0, 30));
  await expect(editor).toHaveAttribute("contenteditable", "true");
  await expect(page.locator("[data-version-preview-bar]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /restore/i })).toHaveCount(0);
  await expect(page.getByText(/Restored version/)).toHaveCount(0);
  expect(await versionCount()).toBe(2);

  // And back to v2.
  await label.click();
  await page.getByRole("button", { name: "Switch to version 2" }).click();
  await expect(label).toContainText("Version 2");
  await expect(editor).toContainText("Second version");
  expect(await versionCount()).toBe(2);

  doc = (await (await page.request.get(`/api/documents/${postId}`)).json()) as { text: string; version: number };
  expect(doc.text).toBe("Second version, totally different.");
});
