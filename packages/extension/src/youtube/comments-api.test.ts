import { describe, expect, it, vi } from "vitest";
import { fetchReplies, fetchTopLevelComments, parseCommentsResponse, parseRepliesResponse } from "./comments-api";
import page1 from "./fixtures/comments-response-page1.sample.json";
import page2 from "./fixtures/comments-response-page2.sample.json";
import repliesResponse from "./fixtures/replies-response.sample.json";

describe("parseCommentsResponse", () => {
  it("extracts only top-level comments, skipping replies and other entity types", () => {
    const result = parseCommentsResponse(page1);

    expect(result.comments.map((comment) => ({ id: comment.id, text: comment.text }))).toEqual([
      { id: "c1", text: "Great video!" },
      { id: "c2", text: "First!" },
    ]);
  });

  it("attaches each comment's own reply continuation and count", () => {
    const result = parseCommentsResponse(page1);
    const c1 = result.comments.find((comment) => comment.id === "c1");
    const c2 = result.comments.find((comment) => comment.id === "c2");

    expect(c1).toMatchObject({ replyCount: "1", repliesContinuation: "SAMPLE_C1_REPLIES_TOKEN" });
    expect(c2).toMatchObject({ replyCount: "0", repliesContinuation: null });
  });

  it("finds the next page token without confusing it with a reply continuation", () => {
    expect(parseCommentsResponse(page1).nextContinuation).toBe("SAMPLE_PAGE_2_TOKEN");
  });

  it("returns null when there is no further page", () => {
    expect(parseCommentsResponse(page2).nextContinuation).toBeNull();
  });
});

describe("parseRepliesResponse", () => {
  it("extracts replies at any nesting level, skipping top-level comments", () => {
    const result = parseRepliesResponse(repliesResponse);

    expect(result.replies).toEqual([
      { id: "c1-reply-1", text: "I agree!" },
      { id: "c1-reply-1-reply-1", text: "Me too" },
    ]);
  });

  it("finds a 'load more replies' continuation the same way as top-level pagination", () => {
    expect(parseRepliesResponse(repliesResponse).nextContinuation).toBe("SAMPLE_MORE_REPLIES_TOKEN");
  });
});

describe("fetchReplies", () => {
  it("fetches and parses a replies page", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => repliesResponse })) as unknown as typeof fetch;

    const result = await fetchReplies("token", "key", {}, fetchImpl);

    expect(result.replies).toHaveLength(2);
    expect(result.nextContinuation).toBe("SAMPLE_MORE_REPLIES_TOKEN");
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
    const iterator = fetchTopLevelComments({
      apiKey: "key",
      context: {},
      initialContinuation: "SAMPLE_PAGE_1_TOKEN",
      fetchImpl,
    });

    let result = await iterator.next();
    while (!result.done) {
      batches.push(result.value.map((comment) => comment.id));
      result = await iterator.next();
    }

    expect(batches).toEqual([["c1", "c2"], ["c3"]]);
    expect(result.value).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("stops early once maxComments is reached, returning the leftover continuation to resume from", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => page1 })) as unknown as typeof fetch;

    const iterator = fetchTopLevelComments({
      apiKey: "key",
      context: {},
      initialContinuation: "SAMPLE_PAGE_1_TOKEN",
      maxComments: 1,
      fetchImpl,
    });

    const first = await iterator.next();
    if (first.done) throw new Error("expected a batch, not the final return value");
    expect(first.value.map((comment) => comment.id)).toEqual(["c1"]);

    const done = await iterator.next();
    expect(done).toEqual({ done: true, value: "SAMPLE_PAGE_2_TOKEN" });
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
