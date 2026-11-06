import { z } from "zod";
import { SCHEMA_VERSION } from "../version.js";

export const SimilarityScoresSchema = z.object({
  textSimilarity: z.number().min(0).max(1),
  geoDistance: z.number().min(0),          // metres
  geoSimilarity: z.number().min(0).max(1), // 1 - normalised distance
  imageSimilarity: z.number().min(0).max(1).nullable(),
  combined: z.number().min(0).max(1),
});
export type SimilarityScores = z.infer<typeof SimilarityScoresSchema>;

export const ClusterResultSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION).default(SCHEMA_VERSION),
  clusterId: z.string(),
  isDuplicate: z.boolean(),
  similarityScores: SimilarityScoresSchema.nullable(),
  reportCount: z.number().int().min(1),
  uniqueReporters: z.number().int().min(1),
  growthRate: z.number().min(0),  // reports per day over window
  communityImpact: z.number().min(0).max(1),
});
export type ClusterResult = z.infer<typeof ClusterResultSchema>;
