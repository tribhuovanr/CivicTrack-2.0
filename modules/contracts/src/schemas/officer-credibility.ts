import { z } from "zod";
import { SCHEMA_VERSION } from "../version.js";
import { ResolvedStatusSchema } from "./repair-verification.js";

export const ClosureSignalSchema = z.enum([
  "verification_failed_but_closed",
  "gps_too_far",
  "closed_too_fast",
  "citizen_reopen",
  "duplicate_photo_hash",
  "bulk_closure_odd_hours",
]);
export type ClosureSignal = z.infer<typeof ClosureSignalSchema>;

export const ClosureEventSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION).default(SCHEMA_VERSION),
  id: z.string(),
  complaintId: z.string(),
  officerId: z.string(),
  closedAt: z.coerce.date(),
  assignedAt: z.coerce.date(),
  verificationResult: ResolvedStatusSchema.nullable(),
  afterGpsDistanceM: z.number().min(0).nullable(),
  afterImageHash: z.string().nullable(),
  citizenDisputed: z.boolean(),
  signals: z.array(ClosureSignalSchema),
  contestNote: z.string().nullable(),
});
export type ClosureEvent = z.infer<typeof ClosureEventSchema>;

export const OfficerCredibilitySchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION).default(SCHEMA_VERSION),
  officerId: z.string(),
  score: z.number().min(0).max(100),
  anomalyScore: z.number().min(0).max(1),   // Isolation Forest output
  signals: z.array(z.object({
    type: ClosureSignalSchema,
    count: z.number().int().min(0),
    lastSeen: z.coerce.date().nullable(),
  })),
  closureCount: z.number().int().min(0),
  reopenRate: z.number().min(0).max(1),
  verificationFailRate: z.number().min(0).max(1),
  disputeRate: z.number().min(0).max(1),
  trend: z.enum(["improving", "stable", "declining"]),
  lastUpdated: z.coerce.date(),
  contestNote: z.string().nullable(),
});
export type OfficerCredibility = z.infer<typeof OfficerCredibilitySchema>;

export const ReviewFlagSchema = z.object({
  type: z.string(),
  reason: z.string(),
  evidence: z.array(z.string()),
  severity: z.enum(["info", "warning", "critical"]),
});
export type ReviewFlag = z.infer<typeof ReviewFlagSchema>;
