import type { Metadata } from "next";

export const metadata: Metadata = { title: "Set up Orbit" };

/** Full-screen setup: no sidebar, no shell. Outside the `(app)` layout, so the onboarding gate never applies here. */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-ground text-text">{children}</div>;
}
