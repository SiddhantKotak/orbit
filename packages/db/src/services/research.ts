import { prisma } from "../client";
import type { Prisma } from "../generated/prisma/client";

/** Searches a profile may run per rolling day (design §6.2). */
export const DAILY_SEARCH_CAP = 40;
/** A brief for the same chat, window and topic younger than this is reused. */
export const BRIEF_REUSE_MS = 24 * 60 * 60 * 1000;

export type StoredBrief = {
  id: string;
  chatId: string;
  topic: string;
  windowStart: string;
  windowEnd: string;
  provider: string;
  items: unknown;
  exclusions: unknown;
  searchCount: number;
  createdAt: Date;
};

export async function saveResearchBrief(
  profileId: string,
  chatId: string,
  input: { topic: string; windowStart: string; windowEnd: string; provider: string; items: unknown; exclusions: unknown; searchCount: number },
): Promise<StoredBrief> {
  return prisma.researchBrief.create({
    data: { profileId, chatId, ...input, items: input.items as Prisma.InputJsonValue, exclusions: input.exclusions as Prisma.InputJsonValue },
  });
}

/** The newest brief of this chat for the same topic and window that is still fresh, or null. */
export async function findFreshBrief(
  profileId: string,
  chatId: string,
  q: { topic: string; windowStart: string; windowEnd: string },
  now = new Date(),
): Promise<StoredBrief | null> {
  return prisma.researchBrief.findFirst({
    where: { profileId, chatId, topic: q.topic, windowStart: q.windowStart, windowEnd: q.windowEnd, createdAt: { gte: new Date(now.getTime() - BRIEF_REUSE_MS) } },
    orderBy: { createdAt: "desc" },
  });
}

/** Provider searches this profile ran in the last 24 hours, counted from stored briefs. */
export async function searchesToday(profileId: string, now = new Date()): Promise<number> {
  const sum = await prisma.researchBrief.aggregate({
    where: { profileId, createdAt: { gte: new Date(now.getTime() - BRIEF_REUSE_MS) } },
    _sum: { searchCount: true },
  });
  return sum._sum.searchCount ?? 0;
}
