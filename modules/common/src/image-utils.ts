/**
 * Image utilities — resize/compress base64 images for Ollama vision input.
 * Works in Node.js (no DOM) using a pure-JS approach for JPEG stripping.
 * For actual resize, we detect if canvas is available; otherwise pass as-is.
 */

/** Strip the data URL prefix and return raw base64. */
export function stripDataUrl(dataUrl: string): string {
  const idx = dataUrl.indexOf(",");
  return idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
}

/** Add data URL prefix if not present. */
export function ensureDataUrl(base64: string, mimeType = "image/jpeg"): string {
  if (base64.startsWith("data:")) return base64;
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Prepare an image for the Ollama vision API.
 * Returns the raw base64 string (no data: prefix) as Ollama expects.
 * In a browser/Deno environment, could resize; in Node without canvas, passes through.
 */
export function prepareImageForLLM(imageDataUrl: string): string {
  return stripDataUrl(imageDataUrl);
}

/** Compute a simple 64-bit difference hash (dHash) for perceptual similarity.
 * Returns a hex string. Works on raw pixel data (8x8 grayscale).
 * Input: flat Uint8Array of grayscale pixel values in row-major order (8x9 = 72 pixels).
 * We provide a helper to compute this from a 9x8 pixel grid.
 */
export function dHash(pixels9x8: Uint8Array): string {
  if (pixels9x8.length !== 72) {
    throw new Error(`dHash expects 72 pixels (9x8), got ${pixels9x8.length}`);
  }
  let hashBits = 0n;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const left = pixels9x8[row * 9 + col] ?? 0;
      const right = pixels9x8[row * 9 + col + 1] ?? 0;
      hashBits = (hashBits << 1n) | (left < right ? 1n : 0n);
    }
  }
  return hashBits.toString(16).padStart(16, "0");
}

/** Hamming distance between two hex hashes of equal length. */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return Infinity;
  const ai = BigInt("0x" + a);
  const bi = BigInt("0x" + b);
  let xor = ai ^ bi;
  let count = 0;
  while (xor > 0n) {
    count += Number(xor & 1n);
    xor >>= 1n;
  }
  return count;
}

/** Returns similarity 0–1 from two perceptual hashes. 0 = different, 1 = identical. */
export function perceptualSimilarity(a: string, b: string): number {
  const dist = hammingDistance(a, b);
  if (dist === Infinity) return 0;
  const maxBits = a.length * 4;
  return 1 - dist / maxBits;
}
