import { describe, expect, it, vi } from "vitest";
import { fetchTopLevelComments, parseCommentsResponse } from "./comments-api";
import page1 from "./fixtures/comments-response-page1.sample.json";
import page2 from "./fixtures/comments-response-page2.sample.json";

describe("parseCommentsResponse", () => {
  it("extracts only top-level comments, skipping replies and other entity types", () => {
    const result = parseCommentsResponse(page1);

    expect(result.comments).toEqual([
      { id: "c1", text: "Great video!" },
      { id: "c2", text: "First!" },
    ]);
  });

  it("finds the next page token without confusing it with a reply continuation", () => {
    expect(parseCommentsResponse(page1).nextContinuation).toBe("SAMPLE_PAGE_2_TOKEN");
  });

  it("returns null when there is no further page", () => {
    expect(parseCommentsResponse(page2).nextContinuation).toBeNull();
  });
});

describe("fetchTopLevelComments", () => {
  it("walks every page and stops when YouTube runs out of continuations", async () => {
    const responses = [page1, page2];
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => responses.shift(),
    })) as unknown as typeof fetch;

    const batches: string[][] = [];
    for await (const batch of fetchTopLevelComments({
      apiKey: "key",
      context: {},
      initialContinuation: "SAMPLE_PAGE_1_TOKEN",
      fetchImpl,
    })) {
      batches.push(batch.map((comment) => comment.id));
    }

    expect(batches).toEqual([["c1", "c2"], ["c3"]]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("stops early once maxComments is reached, without fetching further pages", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => page1 })) as unknown as typeof fetch;

    const batches: string[][] = [];
    for await (const batch of fetchTopLevelComments({
      apiKey: "key",
      context: {},
      initialContinuation: "SAMPLE_PAGE_1_TOKEN",
      maxComments: 1,
      fetchImpl,
    })) {
      batches.push(batch.map((comment) => comment.id));
    }

    expect(batches).toEqual([["c1"]]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("throws when YouTube responds with a non-ok status", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 429 })) as unknown as typeof fetch;

    const iterator = fetchTopLevelComments({
      apiKey: "key",
      context: {},
      initialContinuation: "SAMPLE_PAGE_1_TOKEN",
      fetchImpl,
    });

    await expect(iterator.next()).rejects.toThrow("429");
  });
});
