/** Where first-run setup lives. Outside the `(app)` layout, so the gate below can never redirect to itself. */
export const ONBOARDING_PATH = "/onboarding";

/**
 * The app layout's gate: a profile that has not finished (or left) onboarding is sent to the setup flow, every other
 * profile is never redirected. Existing profiles were marked complete by a migration; profiles added later start complete.
 * Only the app layout calls this, so `/onboarding`, sign-in, API and marketing routes are outside it by construction.
 */
export function onboardingRedirect(profile: { onboardingCompleted: boolean } | null | undefined): string | null {
  if (!profile) return null;
  return profile.onboardingCompleted ? null : ONBOARDING_PATH;
}
