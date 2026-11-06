import type { LLMTransport, LLMChatRequest, LLMRawResponse } from "./types.js";

export class OllamaTransport implements LLMTransport {
  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs: number,
  ) {}

  async chat(request: LLMChatRequest): Promise<LLMRawResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          stream: false,
          ...(request.format ? { format: request.format } : {}),
          options: {
            temperature: request.options?.temperature ?? 0.1,
            num_predict: request.options?.num_predict ?? 512,
          },
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Ollama HTTP ${response.status}: ${body}`);
    }

    const data = await response.json() as {
      message?: { content?: string; thinking?: string };
      done_reason?: string;
    };

    return {
      content: data.message?.content?.trim() ?? "",
      ...(data.message?.thinking ? { thinking: data.message.thinking.trim() } : {}),
      ...(data.done_reason ? { doneReason: data.done_reason } : {}),
    };
  }
}
