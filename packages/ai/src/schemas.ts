import { z } from "zod";

export const GoalSchema = z.enum(["get_customers", "build_authority", "grow_audience"]);
export const ContentTypeSchema = z.enum([
  "lead_magnet",
  "personal",
  "authority",
  "sales",
  "educational",
]);
export const AudienceLevelSchema = z.enum(["broad", "narrow", "niche"]);
export const FormatSchema = z.enum(["text", "image", "carousel", "video", "newsletter", "poll"]);

export type Goal = z.infer<typeof GoalSchema>;
export type ContentType = z.infer<typeof ContentTypeSchema>;
export type AudienceLevel = z.infer<typeof AudienceLevelSchema>;
export type Format = z.infer<typeof FormatSchema>;


export const StrategySchema = z.object({
  goal: GoalSchema,
  goalWhy: z.string(),
  positioning: z.string(),
  positioningWhy: z.string(),
  tagline: z.string(),
  expertise: z.string(),
  expertiseWhy: z.string(),
  contentMix: z.array(z.object({ type: ContentTypeSchema, percent: z.number() })),
  audienceBalance: z.array(
    z.object({ level: AudienceLevelSchema, percent: z.number(), note: z.string() }),
  ),
  contentFormats: z.array(
    z.object({ format: FormatSchema, perWeek: z.number(), note: z.string() }),
  ),
  recurringSeries: z.array(
    z.object({
      name: z.string(),
      weekday: z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
      description: z.string(),
    }),
  ),
});
export type Strategy = z.infer<typeof StrategySchema>;

export const ExtractedMemorySchema = z.object({
  facts: z.array(z.object({ key: z.string(), text: z.string() })),
  refusal: z.boolean(),
});
export type ExtractedMemory = z.infer<typeof ExtractedMemorySchema>;

export const VoiceGuideSchema = z.object({ guide: z.string(), tagline: z.string() });
export type VoiceGuide = z.infer<typeof VoiceGuideSchema>;

export * from "./constants";
