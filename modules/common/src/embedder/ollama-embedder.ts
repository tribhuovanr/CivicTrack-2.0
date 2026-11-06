import type { Embedder } from "./types.js";

export class OllamaEmbedder implements Embedder {
  readonly type = "neural" as const;

  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
    private readonly timeoutMs: number,
  ) {}

  async embed(text: string): Promise<number[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: this.model, input: text }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new Error(`Ollama embed HTTP ${response.status}`);
    }

    const data = await response.json() as { embeddings?: number[][] };
    const embedding = data.embeddings?.[0];
    if (!embedding || embedding.length === 0) {
      throw new Error("Ollama embed returned empty vector");
    }
    return embedding;
  }

  async similarity(a: string, b: string): Promise<number> {
    const [va, vb] = await Promise.all([this.embed(a), this.embed(b)]);
    return cosine(va, vb);
  }
}

function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += (a[i] ?? 0) * (b[i] ?? 0);
    na  += (a[i] ?? 0) ** 2;
    nb  += (b[i] ?? 0) ** 2;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}
