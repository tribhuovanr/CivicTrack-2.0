import { z, ZodSchema } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { LLMTransport, LLMMessage, LLMOptions, LLMResult } from "./types.js";
import { createLogger, type Logger } from "../logger.js";

export class LLMClient {
  private readonly logger: Logger;

  constructor(
    private readonly transport: LLMTransport,
    private readonly defaultModel: string,
    private readonly maxRetries: number = 2,
    private readonly retryBaseDelayMs: number = 500,
    logger?: Logger,
  ) {
    this.logger = logger ?? createLogger("LLMClient");
  }

  /**
   * Query with text messages and get a typed, schema-validated response.
   * Re-prompts once on parse failure. Returns graceful fallback on model failure.
   */
  async query<T>(
    messages: LLMMessage[],
    schema: ZodSchema<T>,
    opts: LLMOptions = {},
  ): Promise<LLMResult<T>> {
    return this.queryInternal(messages, schema, [], opts);
  }

  /**
   * Vision query: messages may include base64 images.
   */
  async queryVision<T>(
    messages: LLMMessage[],
    images: string[],       // base64-encoded images (without data: prefix)
    schema: ZodSchema<T>,
    opts: LLMOptions = {},
  ): Promise<LLMResult<T>> {
    return this.queryInternal(messages, schema, images, opts);
  }

  private async queryInternal<T>(
    messages: LLMMessage[],
    schema: ZodSchema<T>,
    images: string[],
    opts: LLMOptions,
  ): Promise<LLMResult<T>> {
    const model = opts.model ?? this.defaultModel;
    const jsonSchema = zodToJsonSchema(schema, { target: "openApi3" });

    // Attach images to the last user message if provided
    const finalMessages: LLMMessage[] = images.length > 0
      ? messages.map((m, i) => i === messages.length - 1 && m.role === "user"
          ? { ...m, images }
          : m)
      : messages;

    let attempt = 0;
    let lastError = "";

    while (attempt <= this.maxRetries) {
      if (attempt > 0) {
        await this.delay(this.retryBaseDelayMs * Math.pow(2, attempt - 1));
      }

      try {
        const raw = await this.transport.chat({
          model,
          messages: finalMessages,
          format: jsonSchema as Record<string, unknown>,
          options: {
            temperature: opts.temperature ?? 0.1,
            num_predict: opts.numPredict ?? 512,
          },
        });

        const content = raw.content || this.extractFromThinking(raw.thinking ?? "", schema);
        const parseResult = this.parseAndValidate(content, schema);

        if (parseResult.success) {
          this.logger.debug("LLM response parsed successfully", { model, attempt });
          return {
            data: parseResult.data,
            confidence: 1,
            needsHumanReview: false,
            reviewReason: null,
            rawResponse: content,
          };
        }

        // On first parse failure, re-prompt with the error
        lastError = parseResult.error;
        this.logger.warn("LLM response invalid, retrying", { attempt, error: lastError });

        // Add assistant response + correction request to messages for re-prompt
        finalMessages.push(
          { role: "assistant", content },
          { role: "user", content: `Your response was invalid. Error: ${lastError}. Please try again, responding with ONLY valid JSON matching the schema.` },
        );
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        this.logger.warn("LLM request failed", { attempt, error: lastError });
      }

      attempt++;
    }

    // All retries exhausted — return graceful fallback
    this.logger.error("LLM all retries exhausted, returning fallback", { model, lastError });
    return {
      data: this.buildFallback(schema),
      confidence: 0,
      needsHumanReview: true,
      reviewReason: `LLM unavailable or returned invalid output: ${lastError}`,
      rawResponse: "",
    };
  }

  private parseAndValidate<T>(
    content: string,
    schema: ZodSchema<T>,
  ): { success: true; data: T } | { success: false; error: string } {
    // Try direct JSON parse
    let parsed: unknown;
    try {
      // Strip markdown code fences if present
      const cleaned = content
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // Try extracting a JSON object from the text
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) return { success: false, error: "No JSON object found in response" };
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        return { success: false, error: "Response is not valid JSON" };
      }
    }

    const result = schema.safeParse(parsed);
    if (result.success) return { success: true, data: result.data };
    return { success: false, error: result.error.message };
  }

  /**
   * When Gemma4 uses all tokens on thinking and returns empty content,
   * try to extract the JSON object from the thinking text.
   */
  private extractFromThinking<T>(thinking: string, schema: ZodSchema<T>): string {
    const match = thinking.match(/\{[\s\S]*?\}/);
    return match ? match[0] : "";
  }

  /** Build a zero-value fallback that satisfies the schema using its defaults. */
  private buildFallback<T>(schema: ZodSchema<T>): T {
    // For graceful degradation we need a minimal valid object.
    // We attempt to parse an empty object — Zod will apply defaults.
    const result = schema.safeParse({});
    if (result.success) return result.data;
    // If that fails, cast a minimal sentinel object (callers must handle confidence=0)
    return {} as T;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
