import { axeCheck, expectNoHorizontalScroll } from "./helpers/shots";
import { clerk } from "@clerk/testing/playwright";
import { expect, test, type Page } from "@playwright/test";

const email = process.env.E2E_CLERK_USER_EMAIL;

test.skip(!email, "Set E2E_CLERK_USER_EMAIL to a Clerk dev-instance test user");
test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: email! });
}

/** The test user's stand-in for a new sign-up: a fresh un-onboarded profile, made current (dev route, test database only). */
async function devMode(page: Page, mode: "fresh" | "reset") {
  const res = await page.request.post("/api/dev/onboarding", { data: { mode } });
  expect(res.ok(), `POST /api/dev/onboarding ${mode}: ${res.status()}`).toBe(true);
}

test.afterEach(async ({ page }) => {
  await devMode(page, "reset");
});

test("new profile: gated to setup, resumes on refresh, confirms a strategy, lands on Home with ideas and a checklist; set up again works", async ({ page }) => {
  await signIn(page);
  await devMode(page, "fresh");

  // Every app route sends the new profile to setup.
  await page.goto("/");
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole("heading", { level: 1, name: "About you" })).toBeVisible();
  await page.goto("/posts");
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole("navigation", { name: "Setup progress" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Posts" })).toHaveCount(0);

  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await axeCheck(page);
  }

  // Step 1 is required.
  await page.getByLabel("Your name").fill("");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("main [role=alert]")).toContainText("Tell us your name");
  await page.getByLabel("Your name").fill("Ona Reyes");
  await page.getByLabel("Role or title").fill("Design lead");
  await page.getByLabel("Company or industry").fill("Fintech");
  await expect(page.getByLabel("Timezone")).not.toHaveValue("");
  await page.getByLabel("Timezone").selectOption("Europe/London");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Goal and audience" })).toBeVisible();

  // A refresh resumes at the same step.
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Goal and audience" })).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByLabel("Your name")).toHaveValue("Ona Reyes");
  await expect(page.getByLabel("Timezone")).toHaveValue("Europe/London");
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 2 needs a goal.
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("main [role=alert]")).toContainText("Choose what you want LinkedIn to do");
  await page.getByRole("radio", { name: "Win clients" }).click();
  await page.getByRole("button", { name: "Founders" }).click();
  await page.getByLabel("What do you offer?").fill("Design audits for fintech teams");
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 3: a preset style and a rule toggle.
  await expect(page.getByRole("heading", { level: 1, name: "Your voice" })).toBeVisible();
  await page.getByRole("radiogroup", { name: "Writing style" }).getByRole("radio").first().click();
  await page.getByRole("switch", { name: /Emojis/ }).check();
  await axeCheck(page);
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 4: topics from suggestions, one story.
  await expect(page.getByRole("heading", { level: 1, name: "Topics and proof" })).toBeVisible();
  await page.getByRole("button", { name: "Design systems" }).click();
  await page.getByRole("button", { name: "Accessibility" }).click();
  await page.getByLabel("Add your own topic").fill("Design ops");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("3 of 5 selected")).toBeVisible();
  await page.getByLabel("A story or result you are happy to share").fill("I led a design system rollout across four teams.");
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 5: an editable draft; nothing is saved until Confirm.
  await expect(page.getByRole("heading", { level: 1, name: "Your strategy" })).toBeVisible();
  await expect(page.getByLabel("Tagline")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Content pillars" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Your strategy" })).toBeVisible();
  await expect(page.getByLabel("Tagline")).toBeVisible({ timeout: 30_000 });
  await axeCheck(page);
  await page.getByLabel("Tagline").fill("Design that teams adopt");
  await page.getByRole("button", { name: "Confirm and start" }).click();

  // Home: three ready ideas and the checklist.
  await expect(page).toHaveURL(/\/\?welcome=1$/);
  await expect(page.getByRole("heading", { name: /What are we putting out there\?/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Three ideas to start with" })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Draft this/ })).toHaveCount(3, { timeout: 30_000 });
  const checklist = page.getByRole("region", { name: /Getting started/ });
  await expect(checklist).toContainText("0 of 5");
  await expect(checklist.getByRole("link", { name: "Write your first post" })).toBeVisible();
  await expect(checklist.getByText("Coming soon")).toBeVisible();
  await expect(checklist.getByRole("link", { name: "Connect LinkedIn" })).toHaveCount(0);

  // The confirmed strategy was saved.
  await page.goto("/strategy");
  await expect(page.getByText("Design that teams adopt")).toBeVisible();

  // The app is open now; the checklist can be dismissed for good.
  await page.goto("/");
  await page.getByRole("button", { name: "Dismiss" }).click();
  await expect(page.getByRole("region", { name: /Getting started/ })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: /What are we putting out there\?/ })).toBeVisible();
  await expect(page.getByRole("region", { name: /Getting started/ })).toHaveCount(0);

  // Set up again from Settings keeps the app open and the answers filled in.
  await page.goto("/settings");
  await page.getByRole("button", { name: "Set up again" }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole("heading", { level: 1, name: "About you" })).toBeVisible();
  await expect(page.getByLabel("Role or title")).toHaveValue("Design lead");
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: /What are we putting out there\?/ })).toBeVisible();
});

test("skipping setup opens the app and the gate never returns", async ({ page }) => {
  await signIn(page);
  await devMode(page, "fresh");
  await page.goto("/templates");
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByRole("button", { name: "Skip setup" }).click();
  await expect(page.getByRole("heading", { name: /What are we putting out there\?/ })).toBeVisible();
  await page.goto("/templates");
  await expect(page).toHaveURL(/\/templates$/);
});

test("optional steps can be skipped and step 5 can finish without a strategy", async ({ page }) => {
  await signIn(page);
  await devMode(page, "fresh");
  await page.goto("/onboarding");
  await page.getByLabel("Your name").fill("Sam Lee");
  await page.getByLabel("Role or title").fill("Engineer");
  await page.getByRole("button", { name: "Continue" }).click();
  for (const title of ["Goal and audience", "Your voice", "Topics and proof"]) {
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await page.getByRole("button", { name: "Skip", exact: true }).click();
  }
  await expect(page.getByRole("heading", { level: 1, name: "Your strategy" })).toBeVisible();
  await expect(page.getByLabel("Tagline")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Skip strategy" }).click();
  await expect(page.getByRole("heading", { name: /What are we putting out there\?/ })).toBeVisible();
});

test("an existing (onboarded) profile is never redirected", async ({ page }) => {
  await signIn(page);
  await devMode(page, "reset");
  for (const path of ["/", "/posts", "/strategy", "/settings"]) {
    await page.goto(path);
    await expect(page).not.toHaveURL(/\/onboarding/);
  }
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
});

test("the setup screen fits a phone without sideways scroll", async ({ page }) => {
  await signIn(page);
  await devMode(page, "fresh");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/onboarding");
  await expect(page.getByRole("heading", { level: 1, name: "About you" })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await axeCheck(page);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expectNoHorizontalScroll(page);
});
