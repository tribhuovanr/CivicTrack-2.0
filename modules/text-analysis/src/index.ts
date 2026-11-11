import {
  loadConfig,
  LLMClient,
  OllamaTransport,
  createLogger,
} from "@civictrack/common";
import type { ModuleConfig, LLMResult } from "@civictrack/common";
import {
  TextAnalysisSchema,
} from "@civictrack/contracts";
import type { TextAnalysis } from "@civictrack/contracts";

export type { TextAnalysis };
export { TextAnalysisSchema };

// ---------------------------------------------------------------------------
// Deterministic keyword-based category classifier
// ---------------------------------------------------------------------------

const CATEGORY_KEYWORDS: Record<string, readonly string[]> = {
  roads_infrastructure: [
    "pothole", "road", "crack", "pavement", "footpath", "sidewalk", "bridge",
    "highway", "street damage", "asphalt", "broken road", "damaged road",
    "manhole", "speed bump", "divider", "road marking",
  ],
  waste_management: [
    "garbage", "trash", "waste", "litter", "dump", "refuse", "overflowing bin",
    "bin", "rubbish", "pile of waste", "open dumping", "sanitation truck",
    "municipal waste", "sweeping",
  ],
  water_supply: [
    "water", "pipe burst", "leaking pipe", "no water", "water cut", "water scarcity",
    "water shortage", "tap", "borewell", "water tank", "contaminated water",
    "water supply", "drinking water",
  ],
  drainage_sanitation: [
    "drainage", "sewer", "sewage", "drain", "flood", "waterlogging", "stagnant water",
    "open drain", "blocked drain", "overflow", "nala", "sewerage",
  ],
  street_lighting: [
    "light", "streetlight", "street lamp", "lamp post", "dark street", "no light",
    "broken light", "electrical", "power outage", "blackout", "bulb",
  ],
};

/**
 * Deterministic keyword-based category classifier (no LLM).
 * Returns the best-matching ComplaintCategory or null if no match.
 */
export function keywordCategory(
  text: string,
): TextAnalysis["category"] | null {
  const lower = text.toLowerCase();
  let bestCategory: TextAnalysis["category"] | null = null;
  let bestCount = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const count = keywords.filter((kw) => lower.includes(kw)).length;
    if (count > bestCount) {
      bestCount = count;
      bestCategory = category as TextAnalysis["category"];
    }
  }

  return bestCount > 0 ? bestCategory : null;
}

// ---------------------------------------------------------------------------
// LLM prompt builder
// ---------------------------------------------------------------------------

const SCHEMA_DESCRIPTION = `{
  "schemaVersion": "string",
  "detectedLanguage": "BCP-47 language code (e.g. 'en', 'kn', 'hi', 'ta')",
  "category": "one of: roads_infrastructure | waste_management | water_supply | drainage_sanitation | street_lighting | other",
  "subType": "specific sub-issue string e.g. 'pothole', 'overflowing_bin', 'broken_streetlight', 'burst_pipe'",
  "hazardKeywords": ["array", "of", "dangerous", "keywords", "found", "in", "text"],
  "hazardLevel": 0.0,
  "statedDurationDays": null,
  "vulnerableGroupMentioned": false,
  "vulnerableWho": null,
  "locationTextMentions": ["array of location strings mentioned in the text"],
  "englishSummary": "1-2 sentence English summary (max 300 chars)",
  "lifeSafety": false,
  "confidence": 0.9,
  "needsHumanReview": false,
  "reviewReason": null,
  "keywordFallbackCategory": null
}`;

const EXAMPLE_OUTPUT = `{
  "schemaVersion": "1.0",
  "detectedLanguage": "en",
  "category": "roads_infrastructure",
  "subType": "pothole",
  "hazardKeywords": ["deep pothole", "dangerous"],
  "hazardLevel": 0.65,
  "statedDurationDays": 14,
  "vulnerableGroupMentioned": false,
  "vulnerableWho": null,
  "locationTextMentions": ["Main Street", "near bus stand"],
  "englishSummary": "Deep pothole on Main Street near the bus stand has been present for 2 weeks, causing vehicle damage.",
  "lifeSafety": false,
  "confidence": 0.92,
  "needsHumanReview": false,
  "reviewReason": null,
  "keywordFallbackCategory": "roads_infrastructure"
}`;

function buildSystemPrompt(languageHint?: string): string {
  const langNote = languageHint
    ? `\nThe complaint may be written in language with BCP-47 code "${languageHint}". Detect the actual language and report it in detectedLanguage.`
    : "\nDetect the language the complaint is written in and report it as a BCP-47 code in detectedLanguage.";

  return `You are a civic complaint classification AI for a municipal government system.
Your task is to analyse a citizen complaint and return a structured JSON assessment.${langNote}

You MUST respond with ONLY a JSON object matching this schema exactly:
${SCHEMA_DESCRIPTION}

Field rules:
- detectedLanguage: BCP-47 code for the input language (e.g. "en", "kn", "hi", "ta", "te")
- category: classify into exactly one of the six categories
- subType: a specific sub-issue string (snake_case preferred)
- hazardKeywords: words/phrases that indicate danger or urgency found in the text
- hazardLevel: float 0.0 (safe) to 1.0 (extreme danger)
- statedDurationDays: integer if the complaint explicitly states how long the issue has existed, null otherwise
- vulnerableGroupMentioned: true if children, elderly, or disabled people are mentioned
- vulnerableWho: "children" | "elderly" | "disabled" | null
- locationTextMentions: array of place names, street names, landmarks mentioned
- englishSummary: 1-2 sentence English summary of the complaint (max 300 characters)
- lifeSafety: true ONLY if there is immediate risk to human life (e.g. live wire, collapsing structure)
- confidence: your confidence in this classification, 0.0–1.0
- needsHumanReview: true if the complaint is ambiguous, spans multiple categories, or is unclear
- reviewReason: explanation string if needsHumanReview is true, null otherwise
- keywordFallbackCategory: your best deterministic keyword-based category as a double-check (can be same as category, or null if no keywords match)

Example output:
${EXAMPLE_OUTPUT}

Respond with ONLY the JSON object, no markdown, no explanation.`;
}

// ---------------------------------------------------------------------------
// TextAnalyser class
// ---------------------------------------------------------------------------

export class TextAnalyser {
  private readonly client: LLMClient;
  private readonly config: ModuleConfig;
  private readonly logger = createLogger("TextAnalyser");

  constructor(config?: Partial<ModuleConfig>) {
    const base = loadConfig();
    this.config = {
      ollama: { ...base.ollama, ...config?.ollama },
      imageProcessing: {
        ...base.imageProcessing,
        ...config?.imageProcessing,
      },
    };

    const transport = new OllamaTransport(this.config.ollama.baseUrl, this.config.ollama.timeoutMs);
    this.client = new LLMClient(
      transport,
      this.config.ollama.textModel,
      this.config.ollama.maxRetries,
      this.config.ollama.retryBaseDelayMs,
      this.logger,
    );
  }

  /**
   * Analyse a complaint title + description and return a structured TextAnalysis.
   *
   * @param title - Complaint title
   * @param description - Full complaint description
   * @param languageHint - Optional BCP-47 language hint (e.g. "kn", "hi")
   */
  async analyse(
    title: string,
    description: string,
    languageHint?: string,
  ): Promise<LLMResult<TextAnalysis>> {
    const systemPrompt = buildSystemPrompt(languageHint);
    const userMessage = `Title: ${title}\n\nDescription: ${description}`;

    this.logger.info("Analysing complaint text", {
      titleLength: title.length,
      descriptionLength: description.length,
      languageHint,
    });

    const result = await this.client.query(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      TextAnalysisSchema,
      {
        temperature: 0.1,
        numPredict: 768,
      },
    );

    // Inject deterministic fallback category into the result data
    if (result.data && result.confidence > 0) {
      const fallback = keywordCategory(`${title} ${description}`);
      // Only override keywordFallbackCategory if LLM didn't set it
      if (!result.data.keywordFallbackCategory && fallback) {
        const patched = TextAnalysisSchema.parse({
          ...result.data,
          keywordFallbackCategory: fallback,
        });
        return { ...result, data: patched };
      }
    }

    return { ...result, data: TextAnalysisSchema.parse(result.data) };
  }

  /**
   * Like `analyse`, but catches all errors and returns a safe default result
   * rather than throwing. Suitable for fire-and-forget pipelines.
   */
  async analyseWithFallback(
    title: string,
    description: string,
    languageHint?: string,
  ): Promise<LLMResult<TextAnalysis>> {
    try {
      return await this.analyse(title, description, languageHint);
    } catch (err) {
      this.logger.error("TextAnalyser.analyseWithFallback caught error", {
        error: err instanceof Error ? err.message : String(err),
      });

      const fallbackCategory =
        keywordCategory(`${title} ${description}`) ?? "other";

      const fallbackData: TextAnalysis = {
        schemaVersion: "1.0.0" as const,
        detectedLanguage: languageHint ?? "en",
        category: fallbackCategory,
        subType: "unknown",
        hazardKeywords: [],
        hazardLevel: 0,
        statedDurationDays: null,
        vulnerableGroupMentioned: false,
        vulnerableWho: null,
        locationTextMentions: [],
        englishSummary: `${title} (automated fallback — LLM unavailable)`.slice(0, 300),
        lifeSafety: false,
        confidence: 0,
        needsHumanReview: true,
        reviewReason: "LLM analysis failed; using deterministic fallback.",
        keywordFallbackCategory: fallbackCategory,
      };

      return {
        data: fallbackData,
        confidence: 0,
        needsHumanReview: true,
        reviewReason: `LLM analysis failed: ${err instanceof Error ? err.message : String(err)}`,
        rawResponse: "",
      };
    }
  }
}
