import { describe, expect, it, vi } from "vitest";
import { createJevClient } from "./client.js";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const successBody = { answers: { category: { choice: "negativo", confidence: 0.82 } } };

describe("createJevClient", () => {
  it("sends the model, state and category criteria from the spec", async () => {
    const fetchImpl = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => jsonResponse(200, successBody));
    const client = createJevClient("api-key", { fetchImpl });

    await client.classify({ videoTitle: "Mi vídeo", comment: "Qué mal" });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://api.typesafe.ai/v1/systemone");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer api-key" });

    const body = JSON.parse(init?.body as string);
    expect(body.model).toBe("jev-1.13.0");
    expect(body.state).toEqual({ platform: "YouTube", video_title: "Mi vídeo", comment: "Qué mal" });
    expect(Object.keys(body.questions.category.criteria).sort()).toEqual(
      ["constructivo", "irrelevante", "negativo", "neutral", "positivo", "toxico"].sort(),
    );
  });

  it("returns the chosen category and confidence from a successful response", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, successBody));
    const client = createJevClient("api-key", { fetchImpl });

    await expect(client.classify({ videoTitle: "t", comment: "c" })).resolves.toEqual({
      category: "negativo",
      confidence: 0.82,
    });
  });

  it("falls back to sin_clasificar if Jev returns an unknown category", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, { answers: { category: { choice: "not-a-real-category", confidence: 0.9 } } }),
    );
    const client = createJevClient("api-key", { fetchImpl });

    await expect(client.classify({ videoTitle: "t", comment: "c" })).resolves.toEqual({
      category: "sin_clasificar",
      confidence: 0.9,
    });
  });

  it("retries on 429 with increasing backoff and eventually succeeds", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(429, {}))
      .mockResolvedValueOnce(jsonResponse(429, {}))
      .mockResolvedValueOnce(jsonResponse(200, successBody));
    const client = createJevClient("api-key", { fetchImpl, retryBaseDelayMs: 1 });

    await expect(client.classify({ videoTitle: "t", comment: "c" })).resolves.toEqual({
      category: "negativo",
      confidence: 0.82,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("retries on 529 the same way as 429", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(529, {})).mockResolvedValueOnce(jsonResponse(200, successBody));
    const client = createJevClient("api-key", { fetchImpl, retryBaseDelayMs: 1 });

    await expect(client.classify({ videoTitle: "t", comment: "c" })).resolves.toEqual({
      category: "negativo",
      confidence: 0.82,
    });
  });

  it("gives up after exhausting all retry attempts", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(429, {}));
    const client = createJevClient("api-key", { fetchImpl, retryBaseDelayMs: 1 });

    await expect(client.classify({ videoTitle: "t", comment: "c" })).rejects.toThrow();
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it("does not retry on a non-retryable error status", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(400, {}));
    const client = createJevClient("api-key", { fetchImpl, retryBaseDelayMs: 1 });

    await expect(client.classify({ videoTitle: "t", comment: "c" })).rejects.toThrow();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
