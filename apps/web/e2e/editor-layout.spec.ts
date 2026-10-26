import { clerk } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";

/** The post editor never scrolls the page; the chat composer is always inside the viewport (read-only: opens an existing post). */
const email = process.env.E2E_CLERK_USER_EMAIL;
test.skip(!email, "Set E2E_CLERK_USER_EMAIL to a Clerk dev-instance test user");

for (const size of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }]) {
  test(`composer stays in view at ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/sign-in");
    await clerk.signIn({ page, emailAddress: email! });
    await page.goto("/posts");
    const link = page.locator('a[href^="/posts/"]').first();
    test.skip((await link.count()) === 0, "needs one existing post");
    await link.click();
    await page.waitForURL(/\/posts\/[^/]+$/);
    const composer = page.locator("[data-post-chat] textarea").first();
    await expect(composer).toBeVisible();
    const box = (await composer.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(size.height);
    // The Lenis wrapper is gone from the app shell; "never scrolls the page" now means nothing scrolls at document level.
    const scrolls = await page.evaluate(() => ({
      doc: document.documentElement.scrollHeight - innerHeight,
      body: document.body.scrollHeight - innerHeight,
    }));
    expect(scrolls.doc).toBeLessThanOrEqual(1);
    expect(scrolls.body).toBeLessThanOrEqual(1);
  });
}
