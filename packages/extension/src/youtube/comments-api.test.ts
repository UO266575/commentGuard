import { describe, expect, it, vi } from "vitest";
import {
  fetchInitialCommentsContinuation,
  fetchReplies,
  fetchTopLevelComments,
  parseCommentsResponse,
  parseRepliesResponse,
} from "./comments-api";
import page1 from "./fixtures/comments-response-page1.sample.json";
import page2 from "./fixtures/comments-response-page2.sample.json";
import repliesResponse from "./fixtures/replies-response.sample.json";
import nextResponse from "./fixtures/yt-initial-data.sample.json";

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

  it("includes the author, avatar and published time for display", () => {
    const result = parseCommentsResponse(page1);
    const c1 = result.comments.find((comment) => comment.id === "c1");

    expect(c1).toMatchObject({
      author: "@alice",
      authorAvatarUrl: "https://yt3.ggpht.com/alice=s88",
      publishedTime: "2 days ago",
    });
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
      {
        id: "c1-reply-1",
        text: "I agree!",
        author: "@dave",
        authorAvatarUrl: "https://yt3.ggpht.com/dave=s88",
        publishedTime: "5 hours ago",
      },
      {
        id: "c1-reply-1-reply-1",
        text: "Me too",
        author: "@erin",
        authorAvatarUrl: "https://yt3.ggpht.com/erin=s88",
        publishedTime: "4 hours ago",
      },
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

describe("fetchInitialCommentsContinuation", () => {
  // Regression: this must ask YouTube for `videoId` specifically rather than reusing
  // whatever the page happened to load with — see pipeline.ts's classifyVideoComments,
  // which calls this on every "Filtrados" click (including after an in-page SPA
  // navigation to a different video) instead of trusting a cached continuation.
  it("requests the comments continuation for the given video id", async () => {
    const fetchImpl = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => ({
      ok: true,
      json: async () => nextResponse,
    }));

    const result = await fetchInitialCommentsContinuation(
      "video-2",
      "key",
      { some: "context" },
      fetchImpl as unknown as typeof fetch,
    );

    expect(result).toBe("SAMPLE_TOP_SORT_TOKEN");
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://www.youtube.com/youtubei/v1/next?key=key");
    expect(JSON.parse(init?.body as string)).toEqual({ context: { some: "context" }, videoId: "video-2" });
  });

  it("returns null when the response has no comments section", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({}) })) as unknown as typeof fetch;

    await expect(fetchInitialCommentsContinuation("video-2", "key", {}, fetchImpl)).resolves.toBeNull();
  });

  it("throws when YouTube responds with a non-ok status", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 500 })) as unknown as typeof fetch;

    await expect(fetchInitialCommentsContinuation("video-2", "key", {}, fetchImpl)).rejects.toThrow("500");
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
