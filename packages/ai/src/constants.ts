/**
 * Strategy labels and helpers with no runtime dependencies (no zod, no AI SDK), so client components can import them
 * through `@brandloop/ai/constants` without pulling the package barrel into the browser bundle.
 */
import type { AudienceLevel, ContentType, Format, Goal } from "./schemas";

export const GOALS: Record<Goal, { label: string; tagline: string }> = {
  get_customers: { label: "Get customers", tagline: "Turn content into business growth" },
  build_authority: { label: "Build authority", tagline: "Become known for your expertise" },
  grow_audience: { label: "Grow audience", tagline: "Reach more people, grow your following" },
};

export const ONBOARDING_GOALS = {
  clients: { label: "Win clients", strategyGoal: "get_customers" as Goal },
  hire: { label: "Hire great people", strategyGoal: "build_authority" as Goal },
  authority: { label: "Build authority", strategyGoal: "build_authority" as Goal },
  job: { label: "Find a job", strategyGoal: "build_authority" as Goal },
  audience: { label: "Grow my audience", strategyGoal: "grow_audience" as Goal },
} as const;
export type OnboardingGoal = keyof typeof ONBOARDING_GOALS;

export const CONTENT_TYPES: Record<
  ContentType,
  { label: string; description: string; examples: string[] }
> = {
  lead_magnet: {
    label: "Lead magnet",
    description: "Posts that trade value for a signup, comment or DM",
    examples: ["Comment X get Y", "Comment X get DM", "Post to sign-up link"],
  },
  personal: {
    label: "Personal",
    description: "Human stories that build connection and trust",
    examples: [
      "Family",
      "Milestones",
      "Vulnerable moments",
      "Transformations",
      "Burnout",
      "Remote work",
    ],
  },
  authority: {
    label: "Authority",
    description: "Proof of credibility",
    examples: ["Revenue numbers", "Speaking", "Domain expertise", "Results", "Networking"],
  },
  sales: {
    label: "Sales",
    description: "Direct conversion",
    examples: ["Case studies", "Announcements", "CTAs", "Webinars"],
  },
  educational: {
    label: "Educational",
    description: "Teaching",
    examples: [
      "How-to",
      "Listicles",
      "Infographics",
      "Breakdowns",
      "News",
      "Frameworks",
      "Playbooks",
      "Tutorials",
    ],
  },
};

export const AUDIENCE_LEVELS: Record<AudienceLevel, { label: string; description: string }> = {
  broad: { label: "Broad", description: "Top of funnel, aimed at reach and visibility" },
  narrow: { label: "Narrow", description: "Middle of funnel, aimed at engagement and trust" },
  niche: { label: "Niche", description: "Bottom of funnel, aimed at conversions and clients" },
};

export const FORMATS: Record<Format, { label: string }> = {
  text: { label: "Text" },
  image: { label: "Image" },
  carousel: { label: "Carousel" },
  video: { label: "Video" },
  newsletter: { label: "Newsletter" },
  poll: { label: "Poll" },
};

/** Round percents and adjust the largest item so the total is exactly 100. */
export function normalizePercents<T extends { percent: number }>(items: T[]): T[] {
  if (items.length === 0) return [];
  const total = items.reduce((a, i) => a + i.percent, 0);
  const scaled =
    total > 0
      ? items.map((i) => Math.round((i.percent / total) * 100))
      : items.map((_, idx) => (idx === 0 ? 100 : 0));
  const diff = 100 - scaled.reduce((a, n) => a + n, 0);
  let largest = 0;
  scaled.forEach((n, idx) => {
    if (n > (scaled[largest] ?? 0)) largest = idx;
  });
  scaled[largest] = (scaled[largest] ?? 0) + diff;
  return items.map((i, idx) => ({ ...i, percent: scaled[idx] as number }));
}
