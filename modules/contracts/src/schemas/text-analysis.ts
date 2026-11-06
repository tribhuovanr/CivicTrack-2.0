import { z } from "zod";
import { SCHEMA_VERSION } from "../version.js";
import { ComplaintCategorySchema } from "./complaint.js";

export const HazardLevelSchema = z.number().min(0).max(1);

export const TextAnalysisSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION).default(SCHEMA_VERSION),
  detectedLanguage: z.string(),              // BCP 47
  category: ComplaintCategorySchema,
  subType: z.string(),                       // e.g. "pothole", "overflowing_bin"
  hazardKeywords: z.array(z.string()),
  hazardLevel: HazardLevelSchema,
  statedDurationDays: z.number().int().positive().nullable(),
  vulnerableGroupMentioned: z.boolean(),
  vulnerableWho: z.string().nullable(),      // e.g. "children", "elderly"
  locationTextMentions: z.array(z.string()),
  englishSummary: z.string().max(300),
  lifeSafety: z.boolean(),
  confidence: z.number().min(0).max(1),
  needsHumanReview: z.boolean(),
  reviewReason: z.string().nullable(),
  keywordFallbackCategory: ComplaintCategorySchema.nullable(), // deterministic cross-check
});
export type TextAnalysis = z.infer<typeof TextAnalysisSchema>;
