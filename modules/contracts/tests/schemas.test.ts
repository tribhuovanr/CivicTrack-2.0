import { describe, it, expect } from "vitest";
import {
  ComplaintSchema,
  TextAnalysisSchema,
  ImageMatchResultSchema,
  RepairVerificationSchema,
  LocationSeveritySchema,
  ClusterResultSchema,
  PriorityResultSchema,
  SLAResultSchema,
  BreachRiskSchema,
  ClosureEventSchema,
  OfficerCredibilitySchema,
  SCHEMA_VERSION,
} from "../src/index.js";

describe("contracts schemas", () => {
  it("parses a valid Complaint", () => {
    const result = ComplaintSchema.safeParse({
      id: "CT-123456",
      title: "Pothole on main road",
      text: "Large pothole near the school gate causing accidents",
      citizenId: "cit-1",
      submittedAt: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.schemaVersion).toBe(SCHEMA_VERSION);
      expect(result.data.status).toBe("submitted");
      expect(result.data.images).toEqual([]);
    }
  });

  it("rejects Complaint with invalid GPS", () => {
    const result = ComplaintSchema.safeParse({
      id: "CT-1",
      title: "X",
      text: "Y",
      citizenId: "c1",
      submittedAt: new Date().toISOString(),
      gps: { lat: 999, lon: 0 }, // invalid lat
    });
    expect(result.success).toBe(false);
  });

  it("parses a valid TextAnalysis", () => {
    const result = TextAnalysisSchema.safeParse({
      detectedLanguage: "en",
      category: "roads_infrastructure",
      subType: "pothole",
      hazardKeywords: ["pothole", "accident"],
      hazardLevel: 0.8,
      statedDurationDays: 5,
      vulnerableGroupMentioned: false,
      vulnerableWho: null,
      locationTextMentions: ["MG Road"],
      englishSummary: "Large pothole near school gate",
      lifeSafety: false,
      confidence: 0.92,
      needsHumanReview: false,
      reviewReason: null,
      keywordFallbackCategory: "roads_infrastructure",
    });
    expect(result.success).toBe(true);
  });

  it("TextAnalysis with lifeSafety=true is preserved", () => {
    const result = TextAnalysisSchema.safeParse({
      detectedLanguage: "hi",
      category: "drainage_sanitation",
      subType: "open_manhole",
      hazardKeywords: ["open manhole", "accident"],
      hazardLevel: 1.0,
      statedDurationDays: null,
      vulnerableGroupMentioned: true,
      vulnerableWho: "children",
      locationTextMentions: [],
      englishSummary: "Open manhole near school is a danger to children",
      lifeSafety: true,
      confidence: 0.95,
      needsHumanReview: false,
      reviewReason: null,
      keywordFallbackCategory: null,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.lifeSafety).toBe(true);
  });

  it("parses a valid ImageMatchResult", () => {
    const result = ImageMatchResultSchema.safeParse({
      match: "yes",
      confidence: 0.9,
      visibleCategory: "roads_infrastructure",
      visibleSeverityLabel: "high",
      visibleSeverity: 0.9,
      reason: "Image clearly shows a large pothole",
      needsHumanReview: false,
      reviewReason: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects ImageMatchResult with invalid match value", () => {
    const result = ImageMatchResultSchema.safeParse({ match: "maybe" });
    expect(result.success).toBe(false);
  });

  it("parses a valid RepairVerification with canClose=true", () => {
    const result = RepairVerificationSchema.safeParse({
      resolved: "yes",
      sameLocationConfidence: 0.95,
      confidence: 0.9,
      reason: "Pothole is filled and road surface is smooth",
      haversineDistanceM: 12.5,
      gpsWithinRange: true,
      canClose: true,
      needsHumanReview: false,
      reviewReason: null,
    });
    expect(result.success).toBe(true);
  });

  it("parses a valid LocationSeverity", () => {
    const result = LocationSeveritySchema.safeParse({
      locationCriticality: 0.75,
      wardId: "ward-5",
      nearbySensitiveSites: [
        { type: "school", name: "St. Mary School", distanceM: 45 },
      ],
      roadClass: "arterial",
      hotspotFlag: true,
      insideCityBoundary: true,
      reasons: ["Within 50m of a school", "Known accident-prone zone"],
    });
    expect(result.success).toBe(true);
  });

  it("parses a valid ClusterResult", () => {
    const result = ClusterResultSchema.safeParse({
      clusterId: "cluster-abc",
      isDuplicate: true,
      similarityScores: {
        textSimilarity: 0.87,
        geoDistance: 32,
        geoSimilarity: 0.79,
        imageSimilarity: null,
        combined: 0.83,
      },
      reportCount: 4,
      uniqueReporters: 3,
      growthRate: 0.5,
      communityImpact: 0.6,
    });
    expect(result.success).toBe(true);
  });

  it("parses a valid PriorityResult", () => {
    const result = PriorityResultSchema.safeParse({
      score: 82,
      band: "P1",
      lifeSafetyOverride: true,
      breakdown: [
        { component: "severity", weight: 0.35, rawValue: 0.9, contribution: 0.315, reasons: ["high hazard"] },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("PriorityResult rejects invalid band", () => {
    const result = PriorityResultSchema.safeParse({ score: 50, band: "P5", lifeSafetyOverride: false, breakdown: [] });
    expect(result.success).toBe(false);
  });

  it("parses a valid SLAResult", () => {
    const result = SLAResultSchema.safeParse({
      baseHours: 24,
      adjustedHours: 18,
      multipliers: [{ reason: "Critical location", factor: 0.75 }],
      deadline: new Date(Date.now() + 18 * 3600_000).toISOString(),
      extensionCode: null,
    });
    expect(result.success).toBe(true);
  });

  it("parses a valid BreachRisk", () => {
    const result = BreachRiskSchema.safeParse({
      atRisk: true,
      percentElapsed: 71.5,
      alertLevel: "warning",
      status: "assigned",
    });
    expect(result.success).toBe(true);
  });

  it("parses a valid ClosureEvent", () => {
    const result = ClosureEventSchema.safeParse({
      id: "evt-1",
      complaintId: "CT-100001",
      officerId: "off-1",
      closedAt: new Date().toISOString(),
      assignedAt: new Date(Date.now() - 86400_000).toISOString(),
      verificationResult: "no",
      afterGpsDistanceM: 55,
      afterImageHash: "abc123def456",
      citizenDisputed: false,
      signals: ["verification_failed_but_closed", "gps_too_far"],
      contestNote: null,
    });
    expect(result.success).toBe(true);
  });

  it("parses a valid OfficerCredibility", () => {
    const result = OfficerCredibilitySchema.safeParse({
      officerId: "off-1",
      score: 72,
      anomalyScore: 0.3,
      signals: [{ type: "citizen_reopen", count: 2, lastSeen: new Date().toISOString() }],
      closureCount: 15,
      reopenRate: 0.13,
      verificationFailRate: 0.07,
      disputeRate: 0.05,
      trend: "stable",
      lastUpdated: new Date().toISOString(),
      contestNote: null,
    });
    expect(result.success).toBe(true);
  });

  it("OfficerCredibility rejects score > 100", () => {
    const result = OfficerCredibilitySchema.safeParse({
      officerId: "off-1", score: 150, anomalyScore: 0, signals: [],
      closureCount: 0, reopenRate: 0, verificationFailRate: 0, disputeRate: 0,
      trend: "stable", lastUpdated: new Date().toISOString(), contestNote: null,
    });
    expect(result.success).toBe(false);
  });
});
