/**
 * Preset writing styles: the ten archetypes in packages/agent/data/preset-styles.json, each a StyleProfile validated
 * against StyleProfileSchema. The earlier nine invented-persona presets are retired (see LEGACY_PRESET_SLUGS).
 */
import data from "../../agent/data/preset-styles.json";
import { StyleProfileSchema, type StyleProfile } from "@brandloop/ai";
import { renderProfileGuide } from "../src/services/style-guide";

/** Bump when any preset's profile changes; seeding rewrites a preset only when its stored version is lower. */
export const PRESET_PROFILE_VERSION = 3;

export type PresetVoice = { slug: string; name: string; tagline: string; guide: string; profile: StyleProfile };

/** Retired presets. Their rows are never deleted (a profile may have one selected); they are no longer seeded or listed. */
export const LEGACY_PRESET_SLUGS = [
  "tamsin-ashworth", "callum-strand", "priya-lindqvist", "gideon-marsh", "odalys-brennan",
  "kaito-ferreira", "elias-thornquist", "nadine-okoro", "wren-castellano",
];

const TAGLINES: Record<string, string> = {
  "blunt-operator": "Direct verdicts, short lines, no hype",
  "warm-storyteller": "Small real moments with a gentle lesson",
  "data-teacher": "One number at a time, and what it proves",
  "contrarian-analyst": "Challenge the popular belief, then show where it breaks",
  "builder-in-public": "Honest progress: what shipped, what broke, what's next",
  "calm-explainer": "Hard ideas in small, steady steps",
  "punchy-minimalist": "One idea, a few words per line",
  coach: "Encouraging, direct, one practical step",
  curator: "A short chosen list, with reasons and credit",
  "founder-memo": "The decision, the tradeoff, the next step",
};

export const PRESET_VOICES: PresetVoice[] = (data as { slug: string; name: string; profile: unknown }[]).map((p) => {
  const profile = StyleProfileSchema.parse(p.profile);
  return { slug: p.slug, name: p.name, tagline: TAGLINES[p.slug] ?? "", profile, guide: renderProfileGuide(profile) };
});
