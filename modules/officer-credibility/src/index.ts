import {
  OfficerCredibilitySchema,
  ReviewFlagSchema,
  ClosureSignalSchema,
  type OfficerCredibility,
  type ReviewFlag,
  type ClosureSignal,
} from "@civictrack/contracts";

// Re-export all contract types so callers need only this module.
export * from "@civictrack/contracts";

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

/**
 * A single complaint-closure event supplied by the caller.
 * This is the raw input shape (not the Zod-validated ClosureEvent from contracts
 * which includes a `signals` array populated after detection).
 */
export interface ClosureEventInput {
  id: string;
  complaintId: string;
  officerId: string;
  closedAt: Date;
  assignedAt: Date;
  verificationResult: "yes" | "no" | "unclear" | null;
  afterGpsDistanceM: number | null;
  afterImageHash: string | null;
  citizenDisputed: boolean;
  contestNote: string | null;
}

// ---------------------------------------------------------------------------
// Analyser configuration
// ---------------------------------------------------------------------------

export interface OfficerAnalyserConfig {
  /** Minimum hours between assignment and closure; faster = suspicious (default 1) */
  minClosedTooFastHours?: number;
  /** Maximum GPS distance in metres before flagging (default 200) */
  maxGpsDistanceM?: number;
  /** Rolling window in minutes to detect bulk closures (default 30) */
  bulkWindowMinutes?: number;
  /** Number of closures in the window that triggers a bulk signal (default 5) */
  bulkThreshold?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Signal summary aggregated across all events for an officer. */
interface SignalSummary {
  type: ClosureSignal;
  count: number;
  lastSeen: Date | null;
}

// ---------------------------------------------------------------------------
// OfficerAnalyser — deterministic anomaly detection (no LLM)
// ---------------------------------------------------------------------------

/**
 * Performs fully deterministic officer anomaly detection based on closure
 * event patterns.  No LLM calls are made.
 */
export class OfficerAnalyser {
  private readonly minClosedTooFastMs: number;
  private readonly maxGpsDistanceM: number;
  private readonly bulkWindowMs: number;
  private readonly bulkThreshold: number;

  constructor(config: OfficerAnalyserConfig = {}) {
    this.minClosedTooFastMs = (config.minClosedTooFastHours ?? 1) * 3_600_000;
    this.maxGpsDistanceM = config.maxGpsDistanceM ?? 200;
    this.bulkWindowMs = (config.bulkWindowMinutes ?? 30) * 60_000;
    this.bulkThreshold = config.bulkThreshold ?? 5;
  }

  // ---------------------------------------------------------------------------
  // Signal detection
  // ---------------------------------------------------------------------------

  /**
   * Detect anomaly signals for each closure event.
   *
   * @returns Map from event id → list of triggered signals.
   */
  detectSignals(events: ClosureEventInput[]): Map<string, ClosureSignal[]> {
    const result = new Map<string, ClosureSignal[]>();

    // Track image hashes seen across events (for duplicate detection)
    const hashSeen = new Map<string, number>(); // hash → count

    // Sort events by closedAt for bulk-window analysis
    const sorted = [...events].sort(
      (a, b) => a.closedAt.getTime() - b.closedAt.getTime(),
    );

    // Pre-compute bulk-closure flags
    const bulkFlaggedIds = new Set<string>();
    for (let i = 0; i < sorted.length; i++) {
      const anchor = sorted[i]!;
      const windowStart = anchor.closedAt.getTime();
      const windowEnd = windowStart + this.bulkWindowMs;

      const inWindow = sorted.filter(
        (e) =>
          e.closedAt.getTime() >= windowStart &&
          e.closedAt.getTime() <= windowEnd,
      );

      if (inWindow.length >= this.bulkThreshold) {
        const hour = anchor.closedAt.getHours();
        // "odd hours" = 00:00–05:59
        if (hour >= 0 && hour <= 5) {
          inWindow.forEach((e) => bulkFlaggedIds.add(e.id));
        }
      }
    }

    for (const event of events) {
      const signals: ClosureSignal[] = [];

      // 1. Verification failed but closed
      if (
        event.verificationResult === "no" ||
        event.verificationResult === "unclear"
      ) {
        signals.push("verification_failed_but_closed");
      }

      // 2. GPS too far from complaint location
      if (
        event.afterGpsDistanceM !== null &&
        event.afterGpsDistanceM !== undefined &&
        event.afterGpsDistanceM > this.maxGpsDistanceM
      ) {
        signals.push("gps_too_far");
      }

      // 3. Closed too fast
      const durationMs =
        event.closedAt.getTime() - event.assignedAt.getTime();
      if (durationMs < this.minClosedTooFastMs) {
        signals.push("closed_too_fast");
      }

      // 4. Citizen dispute / reopen request
      if (event.citizenDisputed) {
        signals.push("citizen_reopen");
      }

      // 5. Duplicate photo hash (flag on 2nd+ occurrence)
      if (event.afterImageHash !== null) {
        const hash = event.afterImageHash;
        const count = (hashSeen.get(hash) ?? 0) + 1;
        hashSeen.set(hash, count);
        if (count >= 2) {
          signals.push("duplicate_photo_hash");
        }
      }

      // 6. Bulk closure during odd hours
      if (bulkFlaggedIds.has(event.id)) {
        signals.push("bulk_closure_odd_hours");
      }

      result.set(event.id, signals);
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Credibility computation
  // ---------------------------------------------------------------------------

  /**
   * Compute an `OfficerCredibility` record from closure events and their
   * detected signals.
   */
  computeCredibility(
    officerId: string,
    events: ClosureEventInput[],
    signalMap: Map<string, ClosureSignal[]>,
    now?: Date,
  ): OfficerCredibility {
    const closureCount = events.length;

    // --- Rates ----------------------------------------------------------------
    const reopenCount = events.filter((e) => e.citizenDisputed).length;
    const verificationFailCount = events.filter(
      (e) => e.verificationResult === "no",
    ).length;
    const gpsTooFarCount = events.filter((e, _i) => {
      const signals = signalMap.get(e.id) ?? [];
      return signals.includes("gps_too_far");
    }).length;

    const safeCount = Math.max(closureCount, 1);
    const reopenRate = reopenCount / safeCount;
    const verificationFailRate = verificationFailCount / safeCount;
    const disputeRate = reopenCount / safeCount;

    // --- Anomaly score -------------------------------------------------------
    const anomalyScore = clamp(
      reopenRate * 0.4 +
        verificationFailRate * 0.4 +
        (gpsTooFarCount / safeCount) * 0.2,
      0,
      1,
    );

    // --- Credibility score (100 = perfect) -----------------------------------
    const score = clamp(100 - anomalyScore * 100, 0, 100);

    // --- Aggregate signals across all events ---------------------------------
    const signalAccum = new Map<
      ClosureSignal,
      { count: number; lastSeen: Date | null }
    >();

    for (const event of events) {
      const signals = signalMap.get(event.id) ?? [];
      for (const sig of signals) {
        const existing = signalAccum.get(sig);
        if (!existing) {
          signalAccum.set(sig, { count: 1, lastSeen: event.closedAt });
        } else {
          signalAccum.set(sig, {
            count: existing.count + 1,
            lastSeen:
              event.closedAt > (existing.lastSeen ?? event.closedAt)
                ? event.closedAt
                : existing.lastSeen,
          });
        }
      }
    }

    const signals: SignalSummary[] = Array.from(signalAccum.entries()).map(
      ([type, { count, lastSeen }]) => ({ type, count, lastSeen }),
    );

    // --- Trend ---------------------------------------------------------------
    const trend = this.computeTrend(events, signalMap);

    // --- Most recent contest note --------------------------------------------
    const contestNote = events
      .filter((e) => e.contestNote !== null)
      .sort((a, b) => b.closedAt.getTime() - a.closedAt.getTime())[0]
      ?.contestNote ?? null;

    return OfficerCredibilitySchema.parse({
      officerId,
      score,
      anomalyScore,
      signals,
      closureCount,
      reopenRate,
      verificationFailRate,
      disputeRate,
      trend,
      lastUpdated: now ?? new Date(),
      contestNote,
    });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private computeTrend(
    events: ClosureEventInput[],
    signalMap: Map<string, ClosureSignal[]>,
  ): "improving" | "stable" | "declining" {
    if (events.length < 2) return "stable";

    const sorted = [...events].sort(
      (a, b) => a.closedAt.getTime() - b.closedAt.getTime(),
    );
    const half = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, half);
    const secondHalf = sorted.slice(half);

    const anomalyRate = (subset: ClosureEventInput[]) => {
      const count = subset.length;
      if (count === 0) return 0;
      const anomalous = subset.filter(
        (e) => (signalMap.get(e.id) ?? []).length > 0,
      ).length;
      return anomalous / count;
    };

    const r1 = anomalyRate(firstHalf);
    const r2 = anomalyRate(secondHalf);
    const delta = r2 - r1;

    if (delta < -0.1) return "improving";
    if (delta > 0.1) return "declining";
    return "stable";
  }
}

// ---------------------------------------------------------------------------
// Standalone convenience functions
// ---------------------------------------------------------------------------

/**
 * Convenience wrapper around `OfficerAnalyser.detectSignals`.
 */
export function detectClosureSignals(
  events: ClosureEventInput[],
  config?: OfficerAnalyserConfig,
): Map<string, ClosureSignal[]> {
  return new OfficerAnalyser(config).detectSignals(events);
}

/**
 * Generate human-readable `ReviewFlag` items from a computed credibility record.
 * Callers can pass these flags to a review queue or dashboard.
 */
export function generateReviewFlags(
  credibility: OfficerCredibility,
): ReviewFlag[] {
  const flags: ReviewFlag[] = [];

  if (credibility.anomalyScore > 0.8) {
    flags.push(
      ReviewFlagSchema.parse({
        type: "high_anomaly_score",
        reason: `Officer anomaly score is critically high (${(credibility.anomalyScore * 100).toFixed(0)}%).`,
        evidence: [
          `anomalyScore=${credibility.anomalyScore.toFixed(3)}`,
          `closureCount=${credibility.closureCount}`,
        ],
        severity: "critical",
      }),
    );
  }

  if (credibility.reopenRate > 0.3) {
    flags.push(
      ReviewFlagSchema.parse({
        type: "high_reopen_rate",
        reason: `${(credibility.reopenRate * 100).toFixed(0)}% of closures were disputed by citizens.`,
        evidence: [
          `reopenRate=${credibility.reopenRate.toFixed(3)}`,
          `closureCount=${credibility.closureCount}`,
        ],
        severity: "warning",
      }),
    );
  }

  if (credibility.verificationFailRate > 0.3) {
    flags.push(
      ReviewFlagSchema.parse({
        type: "high_verification_fail_rate",
        reason: `${(credibility.verificationFailRate * 100).toFixed(0)}% of closures had a failed verification result.`,
        evidence: [
          `verificationFailRate=${credibility.verificationFailRate.toFixed(3)}`,
          `closureCount=${credibility.closureCount}`,
        ],
        severity: "warning",
      }),
    );
  }

  if (credibility.trend === "declining") {
    flags.push(
      ReviewFlagSchema.parse({
        type: "declining_trend",
        reason: "Officer performance is declining compared to their earlier closure history.",
        evidence: [`trend=${credibility.trend}`],
        severity: "warning",
      }),
    );
  }

  // Check for specific signal types
  for (const sig of credibility.signals) {
    if (sig.type === "bulk_closure_odd_hours" && sig.count >= 3) {
      flags.push(
        ReviewFlagSchema.parse({
          type: "bulk_closure_pattern",
          reason: `Officer has bulk-closed complaints during odd hours ${sig.count} time(s).`,
          evidence: [
            `signal=bulk_closure_odd_hours`,
            `count=${sig.count}`,
            sig.lastSeen ? `lastSeen=${sig.lastSeen.toISOString()}` : "",
          ].filter(Boolean),
          severity: "warning",
        }),
      );
    }

    if (sig.type === "duplicate_photo_hash" && sig.count >= 2) {
      flags.push(
        ReviewFlagSchema.parse({
          type: "duplicate_photo_submissions",
          reason: `Officer reused the same closure photo ${sig.count} time(s).`,
          evidence: [
            `signal=duplicate_photo_hash`,
            `count=${sig.count}`,
          ],
          severity: "critical",
        }),
      );
    }
  }

  return flags;
}
