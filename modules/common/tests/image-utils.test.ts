import { describe, it, expect } from "vitest";
import { dHash, hammingDistance, perceptualSimilarity } from "../src/image-utils.js";

describe("image-utils", () => {
  it("dHash produces 16-char hex string from 72 pixels", () => {
    const pixels = new Uint8Array(72).fill(128);
    const hash = dHash(pixels);
    expect(hash).toHaveLength(16);
    expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
  });

  it("dHash of identical pixel arrays produces identical hash", () => {
    const pixels = Uint8Array.from({ length: 72 }, (_, i) => i * 3 % 256);
    expect(dHash(pixels)).toBe(dHash(pixels));
  });

  it("dHash of different pixel arrays produces different hashes", () => {
    const a = Uint8Array.from({ length: 72 }, () => 50);
    const b = Uint8Array.from({ length: 72 }, () => 200);
    expect(dHash(a)).not.toBe(dHash(b));
  });

  it("dHash throws for wrong pixel count", () => {
    expect(() => dHash(new Uint8Array(64))).toThrow("72 pixels");
  });

  it("hammingDistance of identical hashes is 0", () => {
    expect(hammingDistance("abcdef01234567ab", "abcdef01234567ab")).toBe(0);
  });

  it("hammingDistance of different hashes > 0", () => {
    expect(hammingDistance("0000000000000000", "ffffffffffffffff")).toBeGreaterThan(0);
  });

  it("perceptualSimilarity of identical hashes is 1", () => {
    expect(perceptualSimilarity("abcdef0123456789", "abcdef0123456789")).toBe(1);
  });

  it("perceptualSimilarity of totally different hashes is 0", () => {
    expect(perceptualSimilarity("0000000000000000", "ffffffffffffffff")).toBe(0);
  });

  it("perceptualSimilarity of mismatched length hashes is 0", () => {
    expect(perceptualSimilarity("abcd", "abcdef01")).toBe(0);
  });
});
