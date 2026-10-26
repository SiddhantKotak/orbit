import { StyleProfileSchema, type StyleProfile } from "@brandloop/ai";
import { prisma } from "../client";
import type { Prisma, VoiceStyle } from "../generated/prisma/client";
import { AccountError } from "./account";
import { renderProfileGuide } from "./style-guide";

export { renderProfileGuide };

/** Compiled versions kept per style, besides version 1 (the original), which is never trimmed so a revert can always reach it. */
export const STYLE_VERSIONS_KEPT = 10;

/** A preset, or the caller's own style. Another profile's own style is invisible. */
async function visibleStyle(profileId: string, voiceStyleId: string): Promise<VoiceStyle | null> {
  const row = await prisma.voiceStyle.findUnique({ where: { id: voiceStyleId } });
  return row && (row.kind === "PRESET" || row.profileId === profileId) ? row : null;
}

async function ownStyle(profileId: string, voiceStyleId: string): Promise<VoiceStyle | null> {
  const row = await prisma.voiceStyle.findUnique({ where: { id: voiceStyleId } });
  return row && row.kind === "OWN" && row.profileId === profileId ? row : null;
}

/** The style row with its compiled profile (null for a row that only has a prose guide), or null when it isn't visible. */
export async function getStyleProfile(profileId: string, voiceStyleId: string): Promise<{ style: VoiceStyle; profile: StyleProfile | null } | null> {
  const style = await visibleStyle(profileId, voiceStyleId);
  if (!style) return null;
  const parsed = StyleProfileSchema.safeParse(style.styleProfile);
  return { style, profile: parsed.success ? parsed.data : null };
}

/**
 * Stores a compiled profile as the next version, keeps the last STYLE_VERSIONS_KEPT, marks the style READY and rewrites
 * `guide` from the profile (design §2.3). The profile is validated here, so nothing unvalidated is ever stored.
 */
export async function saveStyleProfile(voiceStyleId: string, profile: StyleProfile, corpusHash: string): Promise<{ version: number }> {
  const valid = StyleProfileSchema.parse(profile);
  const style = await prisma.voiceStyle.findUnique({ where: { id: voiceStyleId } });
  if (!style) throw new AccountError("Writing style not found");
  const version = style.profileVersion + 1;
  const json = valid as unknown as Prisma.InputJsonValue;
  await prisma.$transaction([
    prisma.voiceStyle.update({
      where: { id: voiceStyleId },
      data: {
        styleProfile: json,
        profileVersion: version,
        corpusHash,
        status: "READY",
        statusDetail: null,
        analyzedPostCount: valid.source.postCount,
        analyzedAt: new Date(),
        guide: renderProfileGuide(valid),
      },
    }),
    prisma.voiceStyleVersion.create({ data: { voiceStyleId, version, profile: json, corpusHash } }),
    prisma.voiceStyleVersion.deleteMany({ where: { voiceStyleId, version: { lte: version - STYLE_VERSIONS_KEPT, gt: 1 } } }),
  ]);
  return { version };
}

/** Newest first; null when the style isn't the caller's own. */
export async function listStyleVersions(profileId: string, voiceStyleId: string): Promise<{ version: number; createdAt: Date; corpusHash: string }[] | null> {
  if (!(await ownStyle(profileId, voiceStyleId))) return null;
  return prisma.voiceStyleVersion.findMany({
    where: { voiceStyleId },
    orderBy: { version: "desc" },
    select: { version: true, createdAt: true, corpusHash: true },
  });
}

/** Saves an earlier version again as the newest one. Own styles only. */
export async function restoreStyleVersion(profileId: string, voiceStyleId: string, version: number): Promise<{ version: number }> {
  if (!(await ownStyle(profileId, voiceStyleId))) throw new AccountError("Writing style not found");
  const old = await prisma.voiceStyleVersion.findUnique({ where: { voiceStyleId_version: { voiceStyleId, version } } });
  if (!old) throw new AccountError("That version is no longer kept");
  const restored = StyleProfileSchema.parse(old.profile);
  // Sticky revert: rules the reverted-away profile had and the restored one lacks are never learned again, and the
  // per-post learning marks are kept so the same edits are not re-read.
  const current = StyleProfileSchema.safeParse((await prisma.voiceStyle.findUnique({ where: { id: voiceStyleId } }))?.styleProfile);
  if (current.success) {
    const flat = (p: StyleProfile) => Object.values(p.rules).flatMap((r) => [...r.do, ...r.dont]);
    const keep = new Set(flat(restored).map((r) => r.toLowerCase()));
    const removed = flat(current.data).filter((r) => !keep.has(r.toLowerCase()));
    const suppressed = [...new Set([...(restored.learning?.suppressed ?? []), ...(current.data.learning?.suppressed ?? []), ...removed])].slice(-100);
    restored.learning = { suppressed, lastLearnedVersion: { ...(restored.learning?.lastLearnedVersion ?? {}), ...(current.data.learning?.lastLearnedVersion ?? {}) } };
  }
  return saveStyleProfile(voiceStyleId, restored, old.corpusHash);
}

/** Deletes the profile's own style with its corpus and versions. A preset or another profile's style is not found. */
export async function deleteOwnStyle(profileId: string, voiceStyleId: string): Promise<void> {
  if (!(await ownStyle(profileId, voiceStyleId))) throw new AccountError("Writing style not found");
  await prisma.profile.updateMany({ where: { id: profileId, voiceStyleId }, data: { voiceStyleId: null } });
  await prisma.voiceStyle.delete({ where: { id: voiceStyleId } });
}

/** The style that edit-learning may change: the profile's own style with a valid compiled profile, else null (presets are never changed). */
export async function getLearnTarget(profileId: string): Promise<{ style: VoiceStyle; profile: StyleProfile } | null> {
  const p = await prisma.profile.findUnique({ where: { id: profileId }, select: { voiceStyleId: true } });
  if (!p?.voiceStyleId) return null;
  const style = await ownStyle(profileId, p.voiceStyleId);
  const parsed = style ? StyleProfileSchema.safeParse(style.styleProfile) : null;
  return style && style.status === "READY" && parsed?.success ? { style, profile: parsed.data } : null;
}

/**
 * Saves learned rules as the next version of the caller's own style. `expectedVersion` is the profileVersion the rules
 * were derived from: if the style moved on meanwhile (a re-extraction, a revert) nothing is written. Returns the new
 * version, or null. Every change is a version, so Revert restores the previous profile.
 */
export async function saveLearnedRules(profileId: string, voiceStyleId: string, expectedVersion: number, rules: StyleProfile["rules"], learning: NonNullable<StyleProfile["learning"]>): Promise<{ version: number } | null> {
  const style = await ownStyle(profileId, voiceStyleId);
  const parsed = style ? StyleProfileSchema.safeParse(style.styleProfile) : null;
  if (!style || !parsed?.success || style.profileVersion !== expectedVersion) return null;
  return saveStyleProfile(voiceStyleId, { ...parsed.data, rules, learning }, style.corpusHash ?? "");
}
