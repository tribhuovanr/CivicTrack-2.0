import type { Embedder } from "./types.js";

/** Mock embedder for tests: returns fixed vectors/scores. */
export class MockEmbedder implements Embedder {
  readonly type = "neural" as const;
  public calls: string[] = [];

  constructor(private readonly fixedSimilarity = 0.8) {}

  async embed(text: string): Promise<number[]> {
    this.calls.push(text);
    // Deterministic vector based on text hash — different texts → different vectors
    const hash = simpleHash(text);
    return Array.from({ length: 8 }, (_, i) => Math.sin(hash + i));
  }

  async similarity(a: string, b: string): Promise<number> {
    if (a === b) return 1;
    // If a fixed similarity was set, return it; otherwise compute from embed
    return Promise.resolve(this.fixedSimilarity);
  }
}

function simpleHash(s: string): number {
  let h = 0;
  for (const c of s) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0;
  return h;
}
