import type { Embedder } from "./types.js";

/**
 * Deterministic lexical similarity embedder — no model required.
 * Uses normalised token unigram + bigram overlap (Jaccard coefficient).
 * Falls back automatically when Ollama embedding model is unavailable.
 */
export class LexicalEmbedder implements Embedder {
  readonly type = "lexical" as const;

  async embed(_text: string): Promise<number[]> {
    // Lexical embedder doesn't produce dense vectors — only similarity is meaningful.
    throw new Error("LexicalEmbedder does not produce dense vectors; use similarity() instead");
  }

  async similarity(a: string, b: string): Promise<number> {
    return Promise.resolve(lexicalSimilarity(a, b));
  }
}

export function lexicalSimilarity(a: string, b: string): number {
  const toksA = tokenise(a);
  const toksB = tokenise(b);

  const unigramScore = jaccard(new Set(toksA), new Set(toksB));
  const bigramsA = bigrams(toksA);
  const bigramsB = bigrams(toksB);
  const bigramScore = bigramsA.size === 0 && bigramsB.size === 0
    ? 1
    : jaccard(bigramsA, bigramsB);

  // Weight: 60% unigrams, 40% bigrams
  return 0.6 * unigramScore + 0.4 * bigramScore;
}

function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFC")
    // Strip punctuation, keep Unicode letters/digits/spaces
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function bigrams(tokens: string[]): Set<string> {
  const result = new Set<string>();
  for (let i = 0; i < tokens.length - 1; i++) {
    result.add(`${tokens[i]}_${tokens[i + 1]}`);
  }
  return result;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
