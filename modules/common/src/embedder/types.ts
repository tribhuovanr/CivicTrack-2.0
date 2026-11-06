/** Embedder interface — text → vector or similarity score. */
export interface Embedder {
  embed(text: string): Promise<number[]>;
  /** Cosine similarity between two texts (0=unrelated, 1=identical). */
  similarity(a: string, b: string): Promise<number>;
  /** Whether this embedder uses a real model (vs. lexical fallback). */
  readonly type: "neural" | "lexical";
}
