import { z } from "zod";
import { SCHEMA_VERSION } from "../version.js";

export const SensitiveSiteTypeSchema = z.enum([
  "school",
  "hospital",
  "bus_stop",
  "market",
  "worship_place",
]);
export type SensitiveSiteType = z.infer<typeof SensitiveSiteTypeSchema>;

export const RoadClassSchema = z.enum([
  "arterial",
  "collector",
  "local",
  "highway",
  "unknown",
]);
export type RoadClass = z.infer<typeof RoadClassSchema>;

export const NearbySensitiveSiteSchema = z.object({
  type: SensitiveSiteTypeSchema,
  name: z.string(),
  distanceM: z.number().min(0),
});
export type NearbySensitiveSite = z.infer<typeof NearbySensitiveSiteSchema>;

export const LocationSeveritySchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION).default(SCHEMA_VERSION),
  locationCriticality: z.number().min(0).max(1),
  wardId: z.string().nullable(),
  nearbySensitiveSites: z.array(NearbySensitiveSiteSchema),
  roadClass: RoadClassSchema,
  hotspotFlag: z.boolean(),
  insideCityBoundary: z.boolean(),
  reasons: z.array(z.string()),
});
export type LocationSeverity = z.infer<typeof LocationSeveritySchema>;
