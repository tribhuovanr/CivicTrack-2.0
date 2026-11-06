import { z } from "zod";

/** Config shape loaded from environment variables or a config file. */
export interface ModuleConfig {
  ollama: {
    baseUrl: string;        // default: "http://localhost:11434"
    textModel: string;      // default: "gemma4"
    embeddingModel: string; // default: "nomic-embed-text"
    timeoutMs: number;      // default: 120_000
    maxRetries: number;     // default: 2
    retryBaseDelayMs: number; // default: 500
  };
  imageProcessing: {
    maxDimensionPx: number; // default: 512
    jpegQuality: number;    // default: 0.8
  };
}

const ConfigSchema = z.object({
  OLLAMA_BASE_URL: z.string().url().default("http://localhost:11434"),
  OLLAMA_TEXT_MODEL: z.string().default("gemma4"),
  OLLAMA_EMBEDDING_MODEL: z.string().default("nomic-embed-text"),
  OLLAMA_TIMEOUT_MS: z.coerce.number().positive().default(120_000),
  OLLAMA_MAX_RETRIES: z.coerce.number().int().min(0).default(2),
  OLLAMA_RETRY_BASE_DELAY_MS: z.coerce.number().positive().default(500),
  IMAGE_MAX_DIMENSION_PX: z.coerce.number().int().positive().default(512),
  IMAGE_JPEG_QUALITY: z.coerce.number().min(0.1).max(1).default(0.8),
});

export function loadConfig(env: Record<string, string | undefined> = process.env): ModuleConfig {
  const parsed = ConfigSchema.parse(env);
  return {
    ollama: {
      baseUrl: parsed.OLLAMA_BASE_URL,
      textModel: parsed.OLLAMA_TEXT_MODEL,
      embeddingModel: parsed.OLLAMA_EMBEDDING_MODEL,
      timeoutMs: parsed.OLLAMA_TIMEOUT_MS,
      maxRetries: parsed.OLLAMA_MAX_RETRIES,
      retryBaseDelayMs: parsed.OLLAMA_RETRY_BASE_DELAY_MS,
    },
    imageProcessing: {
      maxDimensionPx: parsed.IMAGE_MAX_DIMENSION_PX,
      jpegQuality: parsed.IMAGE_JPEG_QUALITY,
    },
  };
}

/** Default config — safe for use without env variables. */
export const DEFAULT_CONFIG: ModuleConfig = loadConfig({});
