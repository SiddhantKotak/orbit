/** Static topic ideas for step 4, chosen by the person's role, industry and goal. Suggestions only: nothing is added until they pick it. */
const BY_FIELD: { match: RegExp; topics: string[] }[] = [
  { match: /design|ux|brand|creative/i, topics: ["Design systems", "Design critique", "Working with engineers", "Design careers", "Accessibility", "Design leadership"] },
  { match: /engineer|develop|software|code|tech|data|ai\b|ml\b/i, topics: ["Shipping software", "Engineering leadership", "Code review habits", "Career growth for engineers", "Technical debt", "Using AI at work"] },
  { match: /market|growth|content|seo|brand/i, topics: ["Positioning", "Content that converts", "Marketing experiments", "Founder-led brand", "Measuring what matters", "Customer research"] },
  { match: /sales|account|revenue|business dev/i, topics: ["Discovery calls", "Selling without pressure", "Pipeline habits", "Handling objections", "Buyer research", "Deal reviews"] },
  { match: /found|ceo|startup|owner|entrepreneur/i, topics: ["Building in public", "First customers", "Hiring early", "Fundraising lessons", "Founder mistakes", "Running a small team"] },
  { match: /product|pm\b|program/i, topics: ["Product discovery", "Prioritisation", "Working with stakeholders", "Saying no", "Product metrics", "Roadmaps"] },
  { match: /finance|account|bank|invest|fintech/i, topics: ["Reading the numbers", "Budgeting for teams", "Risk and trust", "Fintech trends", "Career in finance", "Explaining money plainly"] },
  { match: /health|clinic|medic|care|wellness/i, topics: ["Patient stories", "Healthcare myths", "Burnout and balance", "Health tech", "Everyday habits", "Behind the scenes of care"] },
  { match: /recruit|talent|hr\b|people|hiring/i, topics: ["Hiring well", "Interview tips", "Job search advice", "Team culture", "Feedback", "Career moves"] },
  { match: /consult|agency|coach|freelanc/i, topics: ["Client lessons", "Pricing your work", "Running a practice", "Case studies", "Common client mistakes", "Finding good clients"] },
];
const GENERIC = ["Lessons from my work", "Mistakes I have made", "How I make decisions", "Tools and habits I rely on", "What I wish I knew earlier", "Myths in my industry"];
const BY_GOAL: Record<string, string> = {
  clients: "Client results",
  hire: "Life on my team",
  authority: "My point of view",
  job: "What I have shipped",
  audience: "What I am learning",
};

export function suggestTopics(input: { jobTitle?: string; company?: string; goal?: string }, max = 10): string[] {
  const text = `${input.jobTitle ?? ""} ${input.company ?? ""}`;
  const picked = BY_FIELD.filter((f) => f.match.test(text)).flatMap((f) => f.topics);
  const goal = input.goal ? BY_GOAL[input.goal] : undefined;
  return [...new Set([...[...new Set(picked)].slice(0, 7), ...(goal ? [goal] : []), ...GENERIC])].slice(0, max);
}
