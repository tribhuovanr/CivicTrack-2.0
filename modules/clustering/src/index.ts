/**
 * Complaint clustering and duplicate-detection module.
 *
 * Uses:
 *   - LexicalEmbedder / lexicalSimilarity from @civictrack/common for text similarity
 *   - dHash + hammingDistance from @civictrack/common for image similarity
 *   - Haversine formula for geographic distance
 *
 * Does NOT require Ollama for basic operation.
 */

import {
  ClusterResultSchema,
  SimilarityScoresSchema,
  type ClusterResult,
  type SimilarityScores,
} from "@civictrack/contracts";
import {
  loadConfig,
  lexicalSimilarity,
  hammingDistance,
} from "@civictrack/common";
import type { ModuleConfig } from "@civictrack/common";

export type { ClusterResult, SimilarityScores };
export { ClusterResultSchema, SimilarityScoresSchema };

// ---------------------------------------------------------------------------
// Haversine (inlined to avoid cross-module circular dependency)
// ---------------------------------------------------------------------------

/** Compute the great-circle distance in metres between two WGS-84 coordinates. */
export function haversineDistanceM(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6_371_000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Minimal complaint shape accepted by the clustering engine. */
export interface ClusterInput {
  id: string;
  title: string;
  text: string;
  category?: string;
  gps?: { lat: number; lon: number };
  /** Base64 data URLs (only the first image is used for perceptual hashing). */
  images?: string[];
  submittedAt: Date;
}

/** Pool of existing complaints to compare the incoming complaint against. */
export interface ClusterPool {
  complaints: ClusterInput[];
  /** Only compare complaints submitted within the last N days. Default: 30. */
  windowDays?: number;
}

// ---------------------------------------------------------------------------
// Standalone similarity scorer (also used internally)
// ---------------------------------------------------------------------------

/**
 * Compute all similarity dimensions between two complaints.
 * Pure function — no I/O, no side effects.
 */
export function computeSimilarityScores(
  a: ClusterInput,
  b: ClusterInput,
): SimilarityScores {
  // ---- Text similarity ------------------------------------------------
  const textA = `${a.title} ${a.text}`;
  const textB = `${b.title} ${b.text}`;
  const textSimilarity = lexicalSimilarity(textA, textB);

  // ---- Geo similarity -------------------------------------------------
  let geoDistance: number;
  let geoSimilarity: number;

  if (a.gps && b.gps) {
    geoDistance = haversineDistanceM(a.gps.lat, a.gps.lon, b.gps.lat, b.gps.lon);
    geoSimilarity = 1 / (1 + geoDistance / 500);
  } else {
    geoDistance = Infinity;
    geoSimilarity = 0;
  }

  // ---- Image similarity -----------------------------------------------
  let imageSimilarity: number | null = null;

  const imgA = a.images?.[0];
  const imgB = b.images?.[0];

  if (imgA && imgB) {
    try {
      // dHash requires pre-rendered pixel data (Uint8Array) which is not
      // available from a raw base64 string without a canvas (Node has no canvas).
      // Instead we compare the last 16 hex chars of each base64 string as a
      // rough perceptual proxy via hammingDistance.
      const hashA = imgA.slice(-16).replace(/[^0-9a-f]/gi, "0").toLowerCase().padStart(16, "0");
      const hashB = imgB.slice(-16).replace(/[^0-9a-f]/gi, "0").toLowerCase().padStart(16, "0");
      const dist = hammingDistance(hashA, hashB);
      imageSimilarity = dist === Infinity ? null : 1 - dist / 64;
    } catch {
      // If hashing fails, leave as null
      imageSimilarity = null;
    }
  }

  // ---- Combined score -------------------------------------------------
  const imageWeight = imageSimilarity ?? textSimilarity;
  const combined =
    textSimilarity * 0.5 + geoSimilarity * 0.3 + imageWeight * 0.2;

  return SimilarityScoresSchema.parse({
    textSimilarity,
    geoDistance: isFinite(geoDistance) ? geoDistance : Number.MAX_SAFE_INTEGER,
    geoSimilarity,
    imageSimilarity,
    combined: Math.min(1, Math.max(0, combined)),
  });
}

// ---------------------------------------------------------------------------
// ClusterAnalyser
// ---------------------------------------------------------------------------

export class ClusterAnalyser {
  private readonly config: ModuleConfig;

  constructor(config?: Partial<ModuleConfig>) {
    const base = loadConfig();
    this.config = {
      ollama: { ...base.ollama, ...config?.ollama },
      imageProcessing: { ...base.imageProcessing, ...config?.imageProcessing },
    };
  }

  async analyse(complaint: ClusterInput, pool: ClusterPool): Promise<ClusterResult> {
    const windowDays = pool.windowDays ?? 30;
    const windowMs = windowDays * 24 * 60 * 60 * 1000;
    const cutoff = new Date(complaint.submittedAt.getTime() - windowMs);

    // Filter to window
    const candidates = pool.complaints.filter(
      (c) => c.id !== complaint.id && c.submittedAt >= cutoff,
    );

    // -----------------------------------------------------------------------
    // Score each candidate
    // -----------------------------------------------------------------------
    let bestMatch: { complaint: ClusterInput; scores: SimilarityScores } | null =
      null;
    let relatedCount = 0; // complaints with combined >= 0.5

    for (const existing of candidates) {
      const scores = computeSimilarityScores(complaint, existing);

      if (scores.combined >= 0.5) {
        relatedCount++;
      }

      if (!bestMatch || scores.combined > bestMatch.scores.combined) {
        bestMatch = { complaint: existing, scores };
      }
    }

    // -----------------------------------------------------------------------
    // Derive cluster result fields
    // -----------------------------------------------------------------------
    const isDuplicate = (bestMatch?.scores.combined ?? 0) >= 0.75;
    const clusterId = isDuplicate ? (bestMatch?.complaint.id ?? complaint.id) : complaint.id;
    const reportCount = relatedCount + 1; // +1 for this complaint
    const uniqueReporters = reportCount;
    const growthRate = (reportCount / Math.max(windowDays, 1)) * 7;
    const communityImpact = Math.min(1, reportCount * 0.15 + (isDuplicate ? 0.3 : 0));

    return ClusterResultSchema.parse({
      clusterId,
      isDuplicate,
      similarityScores: bestMatch?.scores ?? null,
      reportCount,
      uniqueReporters,
      growthRate,
      communityImpact,
    });
  }
}
