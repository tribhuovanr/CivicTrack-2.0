import { z, ZodSchema } from "zod";

/** Raw HTTP transport — mockable. */
export interface LLMTransport {
  chat(request: LLMChatRequest): Promise<LLMRawResponse>;
}

export interface LLMChatRequest {
  model: string;
  messages: LLMMessage[];
  /** JSON schema to pass as Ollama's format field for structured output. */
  format?: Record<string, unknown>;
  options?: { temperature?: number; num_predict?: number };
}

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
  /** base64-encoded images for vision requests */
  images?: string[];
}

export interface LLMRawResponse {
  content: string;
  thinking?: string | undefined;
  doneReason?: string | undefined;
}

export interface LLMResult<T> {
  data: T;
  confidence: number;
  needsHumanReview: boolean;
  reviewReason: string | null;
  rawResponse: string;
}

export interface LLMOptions {
  temperature?: number;
  numPredict?: number;
  /** Override the model name for this call. */
  model?: string;
}
