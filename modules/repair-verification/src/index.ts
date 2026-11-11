import {
  DEFAULT_CONFIG,
  LLMClient,
  OllamaTransport,
  prepareImageForLLM,
  type ModuleConfig,
  type LLMResult,
} from "@civictrack/common";
import {
  RepairVerificationSchema,
  type RepairVerification,
} from "@civictrack/contracts";

export type { RepairVerification };
export { RepairVerificationSchema };

// ---------------------------------------------------------------------------
// Request shape
// ---------------------------------------------------------------------------

export interface VerificationRequest {
  /** Short title of the original civic complaint */
  complaintTitle: string;
  /** Full body text of the original complaint */
  complaintText: string;
  /**
   * Optional before-photo (original complaint image).
   * data URL or raw base64.
   */
  beforeImageBase64?: string;
  /**
   * After-photo submitted by the officer as proof of completion.
   * data URL or raw base64.  Required.
   */
  afterImageBase64: string;
  /** GPS coordinates from the original complaint photo */
  beforeGps?: { lat: number; lon: number };
  /** GPS coordinates embedded in the officer's completion photo */
  afterGps?: { lat: number; lon: number };
}

// ---------------------------------------------------------------------------
// RepairVerifier — LLM-powered before/after vision comparison
// ---------------------------------------------------------------------------

/**
 * Verifies whether a civic complaint has been repaired by comparing
 * the officer's completion photo against the complaint description
 * (and optional original photo) using Gemma4 vision via Ollama.
 */
export class RepairVerifier {
  private readonly llmClient: LLMClient;
  private readonly config: ModuleConfig;

  constructor(config?: Partial<ModuleConfig>) {
    this.config = {
      ollama: { ...DEFAULT_CONFIG.ollama, ...config?.ollama },
      imageProcessing: {
        ...DEFAULT_CONFIG.imageProcessing,
        ...config?.imageProcessing,
      },
    };

    const transport = new OllamaTransport(
      this.config.ollama.baseUrl,
      this.config.ollama.timeoutMs,
    );

    this.llmClient = new LLMClient(
      transport,
      this.config.ollama.textModel,
      this.config.ollama.maxRetries,
      this.config.ollama.retryBaseDelayMs,
    );
  }

  // ---------------------------------------------------------------------------
  // Public helpers
  // ---------------------------------------------------------------------------

  /**
   * Compute the great-circle distance between two GPS points in metres
   * using the Haversine formula.
   */
  haversineDistanceM(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6_371_000; // Earth radius in metres
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // ---------------------------------------------------------------------------
  // Core analysis
  // ---------------------------------------------------------------------------

  /**
   * Assess whether the reported issue has been resolved.
   *
   * Returns an `LLMResult<RepairVerification>` — confidence=0 and
   * needsHumanReview=true if the LLM is unavailable.
   */
  async verify(req: VerificationRequest): Promise<LLMResult<RepairVerification>> {
    // --- GPS distance ---------------------------------------------------------
    const haversineDistanceM =
      req.beforeGps && req.afterGps
        ? this.haversineDistanceM(
            req.beforeGps.lat,
            req.beforeGps.lon,
            req.afterGps.lat,
            req.afterGps.lon,
          )
        : 0;

    // If GPS is available, require < 100 m; if unavailable, treat as within range.
    const gpsAvailable = req.beforeGps !== undefined && req.afterGps !== undefined;
    const gpsWithinRange = gpsAvailable ? haversineDistanceM < 100 : true;

    // --- Images ---------------------------------------------------------------
    const afterB64 = prepareImageForLLM(req.afterImageBase64);
    const images: string[] = req.beforeImageBase64
      ? [prepareImageForLLM(req.beforeImageBase64), afterB64]
      : [afterB64];

    // --- Prompts --------------------------------------------------------------
    const gpsNote =
      gpsAvailable
        ? `\nGPS distance between original and completion photos: ${haversineDistanceM.toFixed(1)} m (${gpsWithinRange ? "within" : "outside"} 100 m threshold).`
        : "\nNo GPS data available for location verification.";

    const imageInstruction =
      req.beforeImageBase64
        ? "Compare the before photo and after photo. Has the issue been resolved?"
        : "Based on the complaint description and this completion photo, has the issue been resolved?";

    const messages = [
      {
        role: "system" as const,
        content:
          "You are a municipal repair verification AI. Assess whether a repair has been " +
          "completed based on the complaint description and photo(s).",
      },
      {
        role: "user" as const,
        content:
          `Complaint title: ${req.complaintTitle}\n` +
          `Complaint description: ${req.complaintText}` +
          gpsNote +
          `\n\n${imageInstruction}\n\n` +
          "Respond with JSON:\n" +
          "- resolved: \"yes\" | \"no\" | \"unclear\"\n" +
          "- sameLocationConfidence: 0.0–1.0 — confidence the photos are of the same location\n" +
          "- confidence: 0.0–1.0 — overall confidence in the resolved assessment\n" +
          "- reason: explanation (max 300 characters)\n" +
          `- haversineDistanceM: ${haversineDistanceM.toFixed(4)} (use this exact value)\n` +
          `- gpsWithinRange: ${gpsWithinRange} (use this exact value)\n` +
          "- canClose: true only if resolved=\"yes\" AND confidence >= 0.7 AND gpsWithinRange=true\n" +
          "- needsHumanReview: true if resolved=\"unclear\" OR confidence < 0.5 OR gpsWithinRange=false\n" +
          "- reviewReason: explanation string if needsHumanReview is true, otherwise null",
      },
    ];

    const result = await this.llmClient.queryVision(
      messages,
      images,
      RepairVerificationSchema,
    ) as { data: RepairVerification | null } & Awaited<ReturnType<typeof this.llmClient.queryVision>>;

    // Patch computed fields in case the LLM produced wrong values
    if (result.data) {
      const patched = RepairVerificationSchema.parse({
        ...result.data,
        haversineDistanceM,
        gpsWithinRange,
        canClose:
          result.data.resolved === "yes" &&
          result.data.confidence >= 0.7 &&
          gpsWithinRange,
        needsHumanReview:
          result.data.resolved === "unclear" ||
          result.data.confidence < 0.5 ||
          !gpsWithinRange,
      });
      return { ...result, data: patched };
    }

    return { ...result, data: result.data as unknown as RepairVerification };
  }
}
