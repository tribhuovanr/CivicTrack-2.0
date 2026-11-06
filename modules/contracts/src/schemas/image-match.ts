import { z } from "zod";
import { SCHEMA_VERSION } from "../version.js";
import { ComplaintCategorySchema } from "./complaint.js";

export const MatchLevelSchema = z.enum(["yes", "no", "partial"]);
export type MatchLevel = z.infer<typeof MatchLevelSchema>;

export const VisibleSeveritySchema = z.enum(["low", "medium", "high"]);
export type VisibleSeverity = z.infer<typeof VisibleSeveritySchema>;

export const ImageMatchResultSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION).default(SCHEMA_VERSION),
  match: MatchLevelSchema,
  confidence: z.number().min(0).max(1),
  visibleCategory: ComplaintCategorySchema.nullable(),
  visibleSeverityLabel: VisibleSeveritySchema.nullable(),
  visibleSeverity: z.number().min(0).max(1).nullable(),  // mapped: low=0.2, med=0.5, high=0.9
  reason: z.string().max(200),
  needsHumanReview: z.boolean(),
  reviewReason: z.string().nullable(),
});
export type ImageMatchResult = z.infer<typeof ImageMatchResultSchema>;
