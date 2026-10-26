import type { AiClient } from "@brandloop/ai";
import { prisma } from "../client";
import type { VoiceStyle } from "../generated/prisma/client";
import { LEGACY_PRESET_SLUGS, PRESET_VOICES } from "../../prisma/presets";
import { AccountError, assertProfileAccess } from "./account";
import { extractOwnStyle, prepareOwnStyle, STYLE_POSTS_ERROR, validateStylePosts } from "./style-extract";

export const VOICE_POSTS_ERROR = STYLE_POSTS_ERROR;

/**
 * The profile's own style first, then the current presets in their defined order. A retired preset is listed only for
 * a profile that still has it selected (after the current presets).
 */
export async function listVoices(profileId: string): Promise<VoiceStyle[]> {
  const [rows, profile] = await Promise.all([
    prisma.voiceStyle.findMany({ where: { OR: [{ kind: "PRESET" }, { profileId }] }, orderBy: { name: "asc" } }),
    prisma.profile.findUnique({ where: { id: profileId }, select: { voiceStyleId: true } }),
  ]);
  const legacy = new Set(LEGACY_PRESET_SLUGS);
  const order = new Map(PRESET_VOICES.map((p, i) => [p.slug, i]));
  const visible = rows.filter((v) => !(v.slug && legacy.has(v.slug)) || v.id === profile?.voiceStyleId);
  const presets = visible
    .filter((v) => v.profileId !== profileId)
    .sort((a, b) => (order.get(a.slug ?? "") ?? 99) - (order.get(b.slug ?? "") ?? 99));
  return [...visible.filter((v) => v.profileId === profileId), ...presets];
}

export async function selectVoice(userId: string, profileId: string, voiceStyleId: string): Promise<void> {
  await assertProfileAccess(userId, profileId);
  const voice = await prisma.voiceStyle.findUnique({ where: { id: voiceStyleId } });
  const allowed = voice && (voice.kind === "PRESET" || voice.profileId === profileId);
  if (!allowed) throw new AccountError("Writing style not found");
  await prisma.profile.update({ where: { id: profileId }, data: { voiceStyleId } });
}

export async function getSelectedVoice(profileId: string): Promise<VoiceStyle | null> {
  const profile = await prisma.profile.findUnique({ where: { id: profileId }, include: { voiceStyle: true } });
  if (profile?.voiceStyle) return profile.voiceStyle;
  return prisma.voiceStyle.findFirst({ where: { profileId, kind: "OWN" }, orderBy: { updatedAt: "desc" } });
}

export { validateStylePosts as validateVoicePosts };

/** Kept for existing callers: stores the pasted posts as the corpus and compiles the style (Task W4's pipeline). */
export async function createOwnVoice(ai: AiClient, profileId: string, posts: string[]): Promise<VoiceStyle> {
  const cleaned = validateStylePosts(posts);
  const { voiceStyleId } = await prepareOwnStyle(profileId, cleaned, "PASTE");
  await extractOwnStyle(ai, profileId, voiceStyleId);
  return prisma.voiceStyle.findUniqueOrThrow({ where: { id: voiceStyleId } });
}
