import { z } from "zod";
import { SCHEMA_VERSION } from "../version.js";

export const ResolvedStatusSchema = z.enum(["yes", "no", "unclear"]);
export type ResolvedStatus = z.infer<typeof ResolvedStatusSchema>;

export const RepairVerificationSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION).default(SCHEMA_VERSION),
  resolved: ResolvedStatusSchema,
  sameLocationConfidence: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  reason: z.string().max(300),
  haversineDistanceM: z.number().min(0),
  gpsWithinRange: z.boolean(),
  canClose: z.boolean(),
  needsHumanReview: z.boolean(),
  reviewReason: z.string().nullable(),
});
export type RepairVerification = z.infer<typeof RepairVerificationSchema>;
