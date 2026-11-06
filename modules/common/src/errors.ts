/** Base class for all typed errors in civic-triage modules. */
export class CivicTriageError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: unknown,
  ) {
    super(message);
    this.name = "CivicTriageError";
  }
}

export class LLMError extends CivicTriageError {
  constructor(message: string, context?: unknown) {
    super(message, "LLM_ERROR", context);
    this.name = "LLMError";
  }
}

export class LLMTimeoutError extends CivicTriageError {
  constructor(timeoutMs: number) {
    super(`LLM request timed out after ${timeoutMs}ms`, "LLM_TIMEOUT", { timeoutMs });
    this.name = "LLMTimeoutError";
  }
}

export class LLMParseError extends CivicTriageError {
  constructor(raw: string, parseError: string) {
    super(`LLM response failed schema validation: ${parseError}`, "LLM_PARSE_ERROR", { raw, parseError });
    this.name = "LLMParseError";
  }
}

export class EmbedderError extends CivicTriageError {
  constructor(message: string, context?: unknown) {
    super(message, "EMBEDDER_ERROR", context);
    this.name = "EmbedderError";
  }
}

export class ConfigError extends CivicTriageError {
  constructor(message: string, context?: unknown) {
    super(message, "CONFIG_ERROR", context);
    this.name = "ConfigError";
  }
}

export class GeoError extends CivicTriageError {
  constructor(message: string, context?: unknown) {
    super(message, "GEO_ERROR", context);
    this.name = "GeoError";
  }
}
