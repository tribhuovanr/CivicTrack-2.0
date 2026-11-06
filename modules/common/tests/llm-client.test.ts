import { describe, it, expect } from "vitest";
import { z } from "zod";
import { LLMClient } from "../src/llm-client/client.js";
import { MockTransport } from "../src/llm-client/mock-transport.js";
import { noopLogger } from "../src/logger.js";

const TestSchema = z.object({
  category: z.enum(["roads", "waste", "other"]),
  confidence: z.number().min(0).max(1),
});

describe("LLMClient", () => {
  it("parses a valid JSON response", async () => {
    const transport = new MockTransport().enqueue({
      content: JSON.stringify({ category: "roads", confidence: 0.9 }),
    });
    const client = new LLMClient(transport, "gemma4", 0, 0, noopLogger);
    const result = await client.query(
      [{ role: "user", content: "classify this" }],
      TestSchema,
    );
    expect(result.confidence).toBe(1);
    expect(result.data.category).toBe("roads");
    expect(result.needsHumanReview).toBe(false);
  });

  it("handles markdown-fenced JSON", async () => {
    const transport = new MockTransport().enqueue({
      content: "```json\n{\"category\":\"waste\",\"confidence\":0.8}\n```",
    });
    const client = new LLMClient(transport, "gemma4", 0, 0, noopLogger);
    const result = await client.query([{ role: "user", content: "x" }], TestSchema);
    expect(result.data.category).toBe("waste");
  });

  it("re-prompts on first invalid response and succeeds on second", async () => {
    const transport = new MockTransport().enqueue(
      { content: "not json at all" },
      { content: JSON.stringify({ category: "other", confidence: 0.5 }) },
    );
    const client = new LLMClient(transport, "gemma4", 1, 0, noopLogger);
    const result = await client.query([{ role: "user", content: "x" }], TestSchema);
    expect(result.data.category).toBe("other");
    expect(transport.calls.length).toBe(2); // initial + 1 re-prompt
  });

  it("returns graceful fallback when all retries exhausted", async () => {
    const transport = new MockTransport().enqueue(
      { content: "bad" },
      { content: "bad2" },
      { content: "bad3" },
    );
    const client = new LLMClient(transport, "gemma4", 2, 0, noopLogger);
    const result = await client.query([{ role: "user", content: "x" }], TestSchema);
    expect(result.confidence).toBe(0);
    expect(result.needsHumanReview).toBe(true);
    expect(result.reviewReason).toContain("LLM unavailable");
  });

  it("returns graceful fallback when transport throws", async () => {
    const transport = new MockTransport(); // no responses enqueued → throws
    const client = new LLMClient(transport, "gemma4", 0, 0, noopLogger);
    const result = await client.query([{ role: "user", content: "x" }], TestSchema);
    expect(result.confidence).toBe(0);
    expect(result.needsHumanReview).toBe(true);
  });

  it("extracts JSON from surrounding text", async () => {
    const transport = new MockTransport().enqueue({
      content: 'Here is my answer: {"category":"roads","confidence":0.7} as requested.',
    });
    const client = new LLMClient(transport, "gemma4", 0, 0, noopLogger);
    const result = await client.query([{ role: "user", content: "x" }], TestSchema);
    expect(result.data.category).toBe("roads");
  });

  it("includes images in vision query", async () => {
    const transport = new MockTransport().enqueue({
      content: JSON.stringify({ category: "roads", confidence: 0.9 }),
    });
    const client = new LLMClient(transport, "gemma4", 0, 0, noopLogger);
    await client.queryVision(
      [{ role: "user", content: "describe this image" }],
      ["base64data=="],
      TestSchema,
    );
    expect(transport.calls[0]?.messages[0]?.images).toEqual(["base64data=="]);
  });
});
