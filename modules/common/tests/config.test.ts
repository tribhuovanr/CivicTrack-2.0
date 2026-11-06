import { describe, it, expect } from "vitest";
import { loadConfig, DEFAULT_CONFIG } from "../src/config.js";

describe("config", () => {
  it("returns defaults when no env vars set", () => {
    const cfg = loadConfig({});
    expect(cfg.ollama.baseUrl).toBe("http://localhost:11434");
    expect(cfg.ollama.textModel).toBe("gemma4");
    expect(cfg.ollama.embeddingModel).toBe("nomic-embed-text");
    expect(cfg.ollama.timeoutMs).toBe(120_000);
    expect(cfg.ollama.maxRetries).toBe(2);
    expect(cfg.imageProcessing.maxDimensionPx).toBe(512);
  });

  it("overrides from env vars", () => {
    const cfg = loadConfig({
      OLLAMA_BASE_URL: "http://localhost:11435",
      OLLAMA_TEXT_MODEL: "gemma4:2b",
      OLLAMA_TIMEOUT_MS: "60000",
      IMAGE_MAX_DIMENSION_PX: "256",
    });
    expect(cfg.ollama.baseUrl).toBe("http://localhost:11435");
    expect(cfg.ollama.textModel).toBe("gemma4:2b");
    expect(cfg.ollama.timeoutMs).toBe(60_000);
    expect(cfg.imageProcessing.maxDimensionPx).toBe(256);
  });

  it("DEFAULT_CONFIG is accessible", () => {
    expect(DEFAULT_CONFIG.ollama.textModel).toBe("gemma4");
  });
});
