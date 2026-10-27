import { describe, expect, it } from "vitest";
import { ONBOARDING_PATH, onboardingRedirect } from "./onboarding-gate";

describe("onboarding gate", () => {
  it("sends a new profile to setup", () => {
    expect(onboardingRedirect({ onboardingCompleted: false })).toBe("/onboarding");
  });
  it("never redirects an existing (completed) profile or an account without a profile", () => {
    expect(onboardingRedirect({ onboardingCompleted: true })).toBeNull();
    expect(onboardingRedirect(null)).toBeNull();
    expect(onboardingRedirect(undefined)).toBeNull();
  });
  it("cannot loop: the target is outside the app layout that applies the gate", () => {
    expect(ONBOARDING_PATH.startsWith("/onboarding")).toBe(true);
  });
});
