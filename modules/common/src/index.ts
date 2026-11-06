export { loadConfig, DEFAULT_CONFIG } from "./config.js";
export type { ModuleConfig } from "./config.js";

export { createLogger, noopLogger } from "./logger.js";
export type { Logger, LogLevel, LogEntry } from "./logger.js";

export {
  CivicTriageError,
  LLMError,
  LLMTimeoutError,
  LLMParseError,
  EmbedderError,
  ConfigError,
  GeoError,
} from "./errors.js";

export { LLMClient } from "./llm-client/client.js";
export { OllamaTransport } from "./llm-client/ollama-transport.js";
export { MockTransport } from "./llm-client/mock-transport.js";
export type {
  LLMTransport,
  LLMChatRequest,
  LLMMessage,
  LLMRawResponse,
  LLMResult,
  LLMOptions,
} from "./llm-client/types.js";

export { OllamaEmbedder } from "./embedder/ollama-embedder.js";
export { LexicalEmbedder, lexicalSimilarity } from "./embedder/lexical-embedder.js";
export { MockEmbedder } from "./embedder/mock-embedder.js";
export type { Embedder } from "./embedder/types.js";

export {
  stripDataUrl,
  ensureDataUrl,
  prepareImageForLLM,
  dHash,
  hammingDistance,
  perceptualSimilarity,
} from "./image-utils.js";
