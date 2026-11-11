import {
  loadConfig,
  DEFAULT_CONFIG,
  LLMClient,
  OllamaTransport,
  prepareImageForLLM,
  dHash,
  hammingDistance,
  type ModuleConfig,
  type LLMResult,
} from "@civictrack/common";
import {
  ImageMatchResultSchema,
  type ImageMatchResult,
} from "@civictrack/contracts";

export type { ImageMatchResult };
export { ImageMatchResultSchema };

// ---------------------------------------------------------------------------
// Request shape
// ---------------------------------------------------------------------------

export interface MatchRequest {
  /** Short title of the civic complaint */
  complaintTitle: string;
  /** Full body text of the complaint */
  complaintText: string;
  /** data URL (data:image/...;base64,...) or raw base64 string */
  imageBase64: string;
  /** Expected category derived from text analysis (optional hint) */
  category?: string;
}

// ---------------------------------------------------------------------------
// ImageMatcher — LLM-powered vision analysis
// ---------------------------------------------------------------------------

/**
 * Analyses whether a photo matches its complaint description using
 * Gemma4 vision via Ollama.
 */
export class ImageMatcher {
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

  /**
   * Analyse whether the image matches the complaint description.
   *
   * Returns an `LLMResult<ImageMatchResult>` — confidence=0 and
   * needsHumanReview=true if the LLM is unavailable.
   */
  async analyse(req: MatchRequest): Promise<LLMResult<ImageMatchResult>> {
    const imageBase64 = prepareImageForLLM(req.imageBase64);

    const categoryHint = req.category
      ? `\nExpected category from text analysis: ${req.category}`
      : "";

    const messages = [
      {
        role: "system" as const,
        content:
          "You are a civic complaint image analyser. Given a complaint description and image, " +
          "determine if the image matches the complaint text, assess visible severity, and " +
          "identify the category of issue visible.",
      },
      {
        role: "user" as const,
        content:
          `Complaint title: ${req.complaintTitle}\n` +
          `Complaint description: ${req.complaintText}` +
          categoryHint +
          "\n\nAnalyse the attached image and respond with JSON:\n" +
          "- match: \"yes\" | \"no\" | \"partial\"  — does the image show what the text describes?\n" +
          "- confidence: number 0.0–1.0\n" +
          "- visibleCategory: the civic issue category visible in the image " +
          "(roads_infrastructure | waste_management | water_supply | drainage_sanitation | street_lighting | other | null)\n" +
          "- visibleSeverityLabel: \"low\" | \"medium\" | \"high\"\n" +
          "- visibleSeverity: mapped number (low=0.2, medium=0.5, high=0.9)\n" +
          "- reason: 1-2 sentences explaining the assessment (max 200 characters)\n" +
          "- needsHumanReview: true if match is \"partial\" or confidence < 0.5\n" +
          "- reviewReason: explanation string if needsHumanReview is true, otherwise null",
      },
    ];

    return this.llmClient.queryVision(
      messages,
      [imageBase64],
      ImageMatchResultSchema,
    ) as Promise<LLMResult<ImageMatchResult>>;
  }

  /**
   * Hash-only analysis — no LLM.
   * Useful for fast near-duplicate detection before spending LLM tokens.
   *
   * @param pixels9x8 - 72-pixel (9×8) grayscale Uint8Array of the image
   */
  analyseWithoutLLM(pixels9x8: Uint8Array): {
    hash: string;
    similarity: (otherHash: string) => number;
  } {
    const hash = dHash(pixels9x8);
    return {
      hash,
      similarity: (otherHash: string) => {
        const dist = hammingDistance(hash, otherHash);
        if (dist === Infinity) return 0;
        const maxBits = hash.length * 4;
        return 1 - dist / maxBits;
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Module-level convenience export (non-class API)
// ---------------------------------------------------------------------------

/**
 * Standalone helper: compute a perceptual hash and return a similarity
 * comparator without instantiating `ImageMatcher`.
 *
 * @param pixels9x8 - 72-pixel (9×8) grayscale Uint8Array
 */
export function analyseWithoutLLM(pixels9x8: Uint8Array): {
  hash: string;
  similarity: (otherHash: string) => number;
} {
  const hash = dHash(pixels9x8);
  return {
    hash,
    similarity: (otherHash: string) => {
      const dist = hammingDistance(hash, otherHash);
      if (dist === Infinity) return 0;
      const maxBits = hash.length * 4;
      return 1 - dist / maxBits;
    },
  };
}
