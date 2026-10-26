import { clerk } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";

const email = process.env.E2E_CLERK_USER_EMAIL;

test.skip(!email, "Set E2E_CLERK_USER_EMAIL to a Clerk dev-instance test user");

test("writing style: search, select, persist; add-your-style validation", async ({ page }) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: email! });
  await page.goto("/");

  // The picker ignores re-selecting the current style, so a previous run that left
  // Data teacher selected would produce no toast. Guarantee Data teacher is not the current style.
  const selectedStyle = page.getByRole("group", { name: "Selected writing style" });
  await expect(selectedStyle).toBeVisible();
  if ((await selectedStyle.textContent())?.includes("Data teacher")) {
    await page.getByRole("button", { name: "Change writing style" }).click();
    await page.getByRole("combobox", { name: "Search writing styles" }).fill("Coach");
    await expect(page.getByRole("option", { name: /Coach/ })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Writing style: Coach")).toBeVisible();
    await expect(selectedStyle).toContainText("Coach");
  }

  await page.getByRole("button", { name: "Change writing style" }).click();
  await page.getByRole("combobox", { name: "Search writing styles" }).fill("Data teacher");
  await expect(page.getByRole("option", { name: /Data teacher/ })).toBeVisible();
  await expect(page.getByRole("option", { name: /Coach/ })).toHaveCount(0);

  if (process.env.SHOTS === "1") {
    const dir = "../../.superpowers/sdd/plan/shots";
    await page.getByRole("combobox", { name: "Search writing styles" }).fill("");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: `${dir}/voice-1440.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${dir}/voice-390.png` });
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.getByRole("combobox", { name: "Search writing styles" }).fill("Data teacher");
  }

  await page.keyboard.press("Enter");
  await expect(page.getByText("Writing style: Data teacher")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("group", { name: "Selected writing style" })).toContainText("Data teacher");

  await page.getByRole("button", { name: "Change writing style" }).click();
  await page.getByRole("option", { name: /Add your style/ }).click();
  const post = "x".repeat(210);
  await page.getByLabel("Your posts").fill(`${post}\n---\n${post}`);
  await page.getByRole("button", { name: "Learn my style" }).click();
  await expect(page.getByRole("alert")).toHaveText("Paste at least 3 posts of 200+ characters");
});
