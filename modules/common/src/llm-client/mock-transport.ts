import type { LLMTransport, LLMChatRequest, LLMRawResponse } from "./types.js";

/** Deterministic mock transport for tests. */
export class MockTransport implements LLMTransport {
  private responses: LLMRawResponse[] = [];
  private callIndex = 0;
  public calls: LLMChatRequest[] = [];

  /** Enqueue responses to be returned in order. Last one repeats if exhausted. */
  enqueue(...responses: LLMRawResponse[]): this {
    this.responses.push(...responses);
    return this;
  }

  reset(): this {
    this.responses = [];
    this.calls = [];
    this.callIndex = 0;
    return this;
  }

  async chat(request: LLMChatRequest): Promise<LLMRawResponse> {
    this.calls.push(request);
    const idx = Math.min(this.callIndex++, this.responses.length - 1);
    const response = this.responses[idx];
    if (!response) throw new Error("MockTransport: no responses enqueued");
    return response;
  }
}
