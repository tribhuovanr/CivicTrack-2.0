import { describe, it, expect } from "vitest";
import { LexicalEmbedder, lexicalSimilarity } from "../src/embedder/lexical-embedder.js";
import { MockEmbedder } from "../src/embedder/mock-embedder.js";

describe("LexicalEmbedder", () => {
  it("identical texts have similarity 1", async () => {
    expect(lexicalSimilarity("pothole on main road", "pothole on main road")).toBe(1);
  });

  it("completely different texts have low similarity", () => {
    const s = lexicalSimilarity("pothole road repair", "water pipe leaking");
    expect(s).toBeLessThan(0.2);
  });

  it("partially overlapping texts have mid similarity", () => {
    const s = lexicalSimilarity("large pothole near school", "pothole near hospital junction");
    expect(s).toBeGreaterThan(0.2);
    expect(s).toBeLessThan(0.9);
  });

  it("handles Kannada Unicode text without crashing", async () => {
    const a = "ರಸ್ತೆ ಮೇಲೆ ದೊಡ್ಡ ಹಳ್ಳ ಇದೆ"; // "There is a large pothole on the road" in Kannada
    const b = "ರಸ್ತೆ ಮೇಲೆ ಹಳ್ಳ ಇದೆ"; // "There is a pothole on the road"
    const s = lexicalSimilarity(a, b);
    expect(s).toBeGreaterThan(0.4);
  });

  it("handles Hindi text", () => {
    const a = "सड़क पर बड़ा गड्ढा है"; // "There is a large pothole on the road" in Hindi
    const b = "सड़क पर गड्ढा";
    const s = lexicalSimilarity(a, b);
    expect(s).toBeGreaterThan(0.3);
  });

  it("handles code-mixed text", () => {
    const a = "road pe pothole है, please fix karo";
    const b = "pothole on road please fix";
    const s = lexicalSimilarity(a, b);
    expect(s).toBeGreaterThan(0.3);
  });

  it("embed() throws — not supported", async () => {
    const embedder = new LexicalEmbedder();
    await expect(embedder.embed("test")).rejects.toThrow("does not produce dense vectors");
  });

  it("similarity() is async and returns number", async () => {
    const embedder = new LexicalEmbedder();
    const s = await embedder.similarity("garbage pile", "garbage dump");
    expect(s).toBeGreaterThan(0.3);
  });
});

describe("MockEmbedder", () => {
  it("returns fixed similarity for different texts", async () => {
    const embedder = new MockEmbedder(0.75);
    expect(await embedder.similarity("a", "b")).toBe(0.75);
  });

  it("returns 1 for identical texts", async () => {
    const embedder = new MockEmbedder(0.5);
    expect(await embedder.similarity("x", "x")).toBe(1);
  });

  it("embed returns a vector", async () => {
    const embedder = new MockEmbedder();
    const v = await embedder.embed("hello");
    expect(v.length).toBe(8);
  });
});
