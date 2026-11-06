import { z } from "zod";
import { SCHEMA_VERSION } from "../version.js";

export const GpsSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});
export type Gps = z.infer<typeof GpsSchema>;

export const ComplaintCategorySchema = z.enum([
  "roads_infrastructure",
  "waste_management",
  "water_supply",
  "drainage_sanitation",
  "street_lighting",
  "other",
]);
export type ComplaintCategory = z.infer<typeof ComplaintCategorySchema>;

export const ComplaintStatusSchema = z.enum([
  "submitted",
  "under_review",
  "assigned",
  "in_progress",
  "awaiting_verification",
  "resolved",
  "forwarded",
  "rejected_rework",
]);
export type ComplaintStatus = z.infer<typeof ComplaintStatusSchema>;

export const ComplaintSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION).default(SCHEMA_VERSION),
  id: z.string().min(1),
  title: z.string().min(1).max(200),
  text: z.string().min(1),
  category: ComplaintCategorySchema.optional(),
  gps: GpsSchema.optional(),
  ward: z.string().optional(),
  images: z.array(z.string()).default([]),   // base64 data URLs
  citizenId: z.string().min(1),
  deviceId: z.string().optional(),
  submittedAt: z.coerce.date(),
  languageHint: z.string().optional(),       // BCP 47 e.g. "kn", "hi", "en"
  status: ComplaintStatusSchema.default("submitted"),
});
export type Complaint = z.infer<typeof ComplaintSchema>;
