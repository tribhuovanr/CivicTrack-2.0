import { z } from "zod";
import { SCHEMA_VERSION } from "../version.js";

export const PriorityBandSchema = z.enum(["P1", "P2", "P3", "P4"]);
export type PriorityBand = z.infer<typeof PriorityBandSchema>;

export const BreakdownComponentSchema = z.object({
  component: z.string(),
  weight: z.number(),
  rawValue: z.number(),
  contribution: z.number(),   // weight * rawValue
  reasons: z.array(z.string()),
});
export type BreakdownComponent = z.infer<typeof BreakdownComponentSchema>;

export const PriorityResultSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION).default(SCHEMA_VERSION),
  score: z.number().min(0).max(100),
  band: PriorityBandSchema,
  lifeSafetyOverride: z.boolean(),
  breakdown: z.array(BreakdownComponentSchema),
});
export type PriorityResult = z.infer<typeof PriorityResultSchema>;

export const SLAExtensionCodeSchema = z.enum([
  "HEAVY_RAIN",
  "MATERIAL_SHORTAGE",
  "PUBLIC_HOLIDAY",
  "EQUIPMENT_FAILURE",
  "AWAITING_CLEARANCE",
]);
export type SLAExtensionCode = z.infer<typeof SLAExtensionCodeSchema>;

export const SLAMultiplierSchema = z.object({
  reason: z.string(),
  factor: z.number(),       // <1 = shorten, >1 = extend
});

export const SLAResultSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION).default(SCHEMA_VERSION),
  baseHours: z.number().positive(),
  adjustedHours: z.number().positive(),
  multipliers: z.array(SLAMultiplierSchema),
  deadline: z.coerce.date(),
  extensionCode: SLAExtensionCodeSchema.nullable(),
});
export type SLAResult = z.infer<typeof SLAResultSchema>;

export const BreachRiskSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION).default(SCHEMA_VERSION),
  atRisk: z.boolean(),
  percentElapsed: z.number().min(0),
  alertLevel: z.enum(["none", "warning", "critical"]),
  status: z.string(),
});
export type BreachRisk = z.infer<typeof BreachRiskSchema>;
