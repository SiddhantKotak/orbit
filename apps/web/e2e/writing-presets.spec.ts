import { clerk } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";

/**
 * Writing engine W3: each preset is a measured style profile; the picker's Details sheet shows the measured layout and
 * one original reference post. Kleo evidence: A1 / WQ §1.2 (compiled profiles with numeric layout and reference posts),
 * WQ §1.1 (layout spread across presets). Voice.spec stays green alongside.
 */
const email = process.env.E2E_CLERK_USER_EMAIL;
test.skip(!email, "Set E2E_CLERK_USER_EMAIL to a Clerk dev-instance test user");

test("preset details show the measured layout and a reference post, then the preset can be selected", async ({ page }) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: email! });
  await page.goto("/");

  await page.getByRole("button", { name: "Change writing style" }).click();
  await page.getByRole("combobox", { name: "Search writing styles" }).fill("Data teacher");
  await page.getByRole("button", { name: "Details: Data teacher" }).click();

  const sheet = page.getByRole("dialog", { name: "Data teacher" });
  await expect(sheet.locator("[data-style-layout]")).toHaveText(/Hooks ~\d+ characters/);
  await expect(sheet.locator("[data-style-reference]")).not.toBeEmpty();

  // A second preset shows its own layout.
  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(sheet).toHaveCount(0);
  await page.getByRole("button", { name: "Change writing style" }).click();
  await page.getByRole("combobox", { name: "Search writing styles" }).fill("Punchy minimalist");
  await page.getByRole("button", { name: "Details: Punchy minimalist" }).click();
  const elias = page.getByRole("dialog", { name: "Punchy minimalist" });
  await expect(elias.locator("[data-style-layout]")).toHaveText(/Hooks ~\d+ characters/);
  await elias.getByRole("button", { name: "Close" }).click();

  // Select a preset (one that is not already selected, since re-selecting is a no-op); the group shows its name.
  const group = page.getByRole("group", { name: "Selected writing style" });
  const name = (await group.textContent())?.includes("Builder in public") ? "Curator" : "Builder in public";
  await page.getByRole("button", { name: "Change writing style" }).click();
  await page.getByRole("combobox", { name: "Search writing styles" }).fill(name);
  await page.getByRole("option", { name: new RegExp(name) }).click();
  await expect(page.getByText(`Writing style: ${name}`)).toBeVisible();
  await expect(group).toContainText(name);
});
