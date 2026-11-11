import { SCHEMA_VERSION } from "@civictrack/contracts";
import type {
  PriorityBand,
  PriorityResult,
  BreakdownComponent,
  SLAResult,
  BreachRisk,
} from "@civictrack/contracts";

export type {
  PriorityBand,
  PriorityResult,
  BreakdownComponent,
  SLAResult,
  BreachRisk,
};
export {
  PriorityBandSchema,
  PriorityResultSchema,
  SLAResultSchema,
  BreachRiskSchema,
  BreakdownComponentSchema,
  SLAExtensionCodeSchema,
  SLAMultiplierSchema,
} from "@civictrack/contracts";

// ---------------------------------------------------------------------------
// SLA Hours by Priority Band
// ---------------------------------------------------------------------------

export const SLA_HOURS_BY_BAND: Record<PriorityBand, number> = {
  P1: 12,
  P2: 48,
  P3: 120,
  P4: 336,
} as const;

// ---------------------------------------------------------------------------
// PriorityInput interface
// ---------------------------------------------------------------------------

export interface PriorityInput {
  /** 0–1 from TextAnalysis */
  hazardLevel: number;
  /** from TextAnalysis */
  lifeSafety: boolean;
  /** 0–1 from GeoSeverity (optional, default 0) */
  locationCriticality?: number;
  /** 0–1 from ClusterResult (optional, default 0) */
  communityImpact?: number;
  vulnerableGroupMentioned: boolean;
  statedDurationDays: number | null;
  category: string;
}

// ---------------------------------------------------------------------------
// SLA multiplier input (re-expressed for clarity, matches contracts shape)
// ---------------------------------------------------------------------------

export interface SLAMultiplierInput {
  reason: string;
  /** < 1 = shorten, > 1 = extend */
  factor: number;
}

// ---------------------------------------------------------------------------
// computePriority
// ---------------------------------------------------------------------------

/** Clamp a number between [min, max]. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Compute a priority band and score for a complaint using a weighted formula.
 *
 * Score components (sum → 0–100):
 * - hazardLevel × 40
 * - lifeSafety × 40 (override weight)
 * - locationCriticality × 15
 * - communityImpact × 5
 * - +5 bonus if vulnerableGroupMentioned
 * - +3 bonus if statedDurationDays > 7
 *
 * Band mapping: score ≥ 80 → P1, ≥ 60 → P2, ≥ 40 → P3, else P4
 * lifeSafetyOverride forces band to P1 and score to max(score, 85).
 */
export function computePriority(input: PriorityInput): PriorityResult {
  const {
    hazardLevel,
    lifeSafety,
    locationCriticality = 0,
    communityImpact = 0,
    vulnerableGroupMentioned,
    statedDurationDays,
  } = input;

  const hazardContrib = clamp(hazardLevel, 0, 1) * 40;
  const lifeSafetyContrib = lifeSafety ? 40 : 0;
  const locationContrib = clamp(locationCriticality, 0, 1) * 15;
  const communityContrib = clamp(communityImpact, 0, 1) * 5;
  const vulnerableBonus = vulnerableGroupMentioned ? 5 : 0;
  const durationBonus = statedDurationDays !== null && statedDurationDays > 7 ? 3 : 0;

  let rawScore =
    hazardContrib +
    lifeSafetyContrib +
    locationContrib +
    communityContrib +
    vulnerableBonus +
    durationBonus;

  // Life-safety override: force to P1, minimum score 85
  const lifeSafetyOverride = lifeSafety;
  if (lifeSafetyOverride) {
    rawScore = Math.max(rawScore, 85);
  }

  const score = clamp(rawScore, 0, 100);

  // Band mapping
  let band: PriorityBand;
  if (lifeSafetyOverride || score >= 80) {
    band = "P1";
  } else if (score >= 60) {
    band = "P2";
  } else if (score >= 40) {
    band = "P3";
  } else {
    band = "P4";
  }

  const breakdown: BreakdownComponent[] = [
    {
      component: "hazardLevel",
      weight: 40,
      rawValue: clamp(hazardLevel, 0, 1),
      contribution: hazardContrib,
      reasons: hazardContrib > 0 ? [`hazardLevel ${hazardLevel.toFixed(2)} × weight 40`] : ["no hazard detected"],
    },
    {
      component: "lifeSafety",
      weight: 40,
      rawValue: lifeSafety ? 1 : 0,
      contribution: lifeSafetyContrib,
      reasons: lifeSafety
        ? ["immediate life safety risk — maximum weight applied"]
        : ["no immediate life safety risk"],
    },
    {
      component: "locationCriticality",
      weight: 15,
      rawValue: clamp(locationCriticality, 0, 1),
      contribution: locationContrib,
      reasons:
        locationContrib > 0
          ? [`locationCriticality ${locationCriticality.toFixed(2)} × weight 15`]
          : ["location criticality not provided or zero"],
    },
    {
      component: "communityImpact",
      weight: 5,
      rawValue: clamp(communityImpact, 0, 1),
      contribution: communityContrib,
      reasons:
        communityContrib > 0
          ? [`communityImpact ${communityImpact.toFixed(2)} × weight 5`]
          : ["community impact not provided or zero"],
    },
    {
      component: "vulnerableGroupBonus",
      weight: 5,
      rawValue: vulnerableGroupMentioned ? 1 : 0,
      contribution: vulnerableBonus,
      reasons: vulnerableGroupMentioned
        ? ["+5 bonus: vulnerable group (children/elderly/disabled) mentioned"]
        : ["no vulnerable group mentioned"],
    },
    {
      component: "statedDurationBonus",
      weight: 3,
      rawValue: statedDurationDays !== null && statedDurationDays > 7 ? 1 : 0,
      contribution: durationBonus,
      reasons:
        durationBonus > 0
          ? [`+3 bonus: issue stated for ${statedDurationDays} days (> 7)`]
          : [
              statedDurationDays !== null
                ? `no bonus: stated duration ${statedDurationDays} days (≤ 7)`
                : "no stated duration",
            ],
    },
  ];

  return {
    schemaVersion: SCHEMA_VERSION,
    score,
    band,
    lifeSafetyOverride,
    breakdown,
  };
}

// ---------------------------------------------------------------------------
// computeSLA
// ---------------------------------------------------------------------------

const MULTIPLIER_MIN = 0.5;
const MULTIPLIER_MAX = 3.0;

/**
 * Compute an SLA deadline for a given priority band.
 *
 * @param band - Priority band (P1–P4)
 * @param submittedAt - When the complaint was submitted
 * @param multipliers - Optional list of {reason, factor} modifiers
 */
export function computeSLA(
  band: PriorityBand,
  submittedAt: Date,
  multipliers?: SLAMultiplierInput[],
): SLAResult {
  const baseHours = SLA_HOURS_BY_BAND[band];
  const appliedMultipliers = multipliers ?? [];

  // Product of all factors, clamped between 0.5× and 3×
  const rawFactor = appliedMultipliers.reduce(
    (acc, m) => acc * m.factor,
    1,
  );
  const effectiveFactor = clamp(rawFactor, MULTIPLIER_MIN, MULTIPLIER_MAX);

  const adjustedHours = baseHours * effectiveFactor;
  const deadline = new Date(
    submittedAt.getTime() + adjustedHours * 60 * 60 * 1000,
  );

  return {
    schemaVersion: SCHEMA_VERSION,
    baseHours,
    adjustedHours,
    multipliers: appliedMultipliers.map((m) => ({
      reason: m.reason,
      factor: m.factor,
    })),
    deadline,
    extensionCode: null,
  };
}

// ---------------------------------------------------------------------------
// checkBreachRisk
// ---------------------------------------------------------------------------

/**
 * Check whether an SLA is at risk of breach or already breached.
 *
 * @param slaResult - The SLA result returned by computeSLA
 * @param now - Current time (defaults to Date.now())
 */
export function checkBreachRisk(
  slaResult: SLAResult,
  now: Date = new Date(),
): BreachRisk {
  const { deadline, adjustedHours } = slaResult;

  // Reconstruct the submission time from deadline and adjustedHours
  const startMs = deadline.getTime() - adjustedHours * 60 * 60 * 1000;
  const totalMs = adjustedHours * 60 * 60 * 1000;
  const elapsedMs = now.getTime() - startMs;

  const percentElapsed = Math.max(0, (elapsedMs / totalMs) * 100);
  const isBreached = now.getTime() > deadline.getTime();
  const atRisk = percentElapsed > 80 || isBreached;

  let alertLevel: BreachRisk["alertLevel"];
  if (isBreached || percentElapsed > 100) {
    alertLevel = "critical";
  } else if (percentElapsed > 80) {
    alertLevel = "warning";
  } else {
    alertLevel = "none";
  }

  let status: string;
  if (isBreached) {
    const overMs = now.getTime() - deadline.getTime();
    const overHours = (overMs / (60 * 60 * 1000)).toFixed(1);
    status = `SLA BREACHED — ${overHours}h overdue. Deadline was ${deadline.toISOString()}.`;
  } else if (alertLevel === "warning") {
    const remainMs = deadline.getTime() - now.getTime();
    const remainHours = (remainMs / (60 * 60 * 1000)).toFixed(1);
    status = `At risk — ${remainHours}h remaining (${percentElapsed.toFixed(0)}% elapsed). Deadline: ${deadline.toISOString()}.`;
  } else {
    const remainMs = deadline.getTime() - now.getTime();
    const remainHours = (remainMs / (60 * 60 * 1000)).toFixed(1);
    status = `On track — ${remainHours}h remaining (${percentElapsed.toFixed(0)}% elapsed). Deadline: ${deadline.toISOString()}.`;
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    atRisk,
    percentElapsed,
    alertLevel,
    status,
  };
}
