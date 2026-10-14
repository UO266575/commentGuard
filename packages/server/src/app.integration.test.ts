import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import type { GoogleTokenVerifier } from "./auth/google.js";
import { createDatabase, type DatabaseHandle } from "./db/client.js";
import { testDatabaseUrl, truncateAll } from "./db/test-db.js";
import type { JevClient } from "./jev/client.js";
import { getRemainingQuota } from "./quota/repository.js";

const url = testDatabaseUrl();
const fakeIdentity = { googleSub: "sub-1", email: "person@example.com" };
const fakeVerifier: GoogleTokenVerifier = { verify: async () => fakeIdentity };
const fakeJevClient: JevClient = { classify: async () => ({ category: "negativo", confidence: 0.82 }) };

async function login(app: ReturnType<typeof createApp>) {
  const res = await app.request("/api/auth/google", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken: "fake-token" }),
  });
  const { sessionToken } = (await res.json()) as { sessionToken: string };
  return sessionToken;
}

describe.skipIf(!url)("auth + classify flow", () => {
  let handle: DatabaseHandle;

  beforeAll(() => {
    handle = createDatabase(url!);
  });

  beforeEach(() => truncateAll(handle));

  afterAll(() => handle.close());

  it("logs in with a verified Google token and creates the user", async () => {
    const app = createApp({ db: handle.db, googleVerifier: fakeVerifier, jevClient: fakeJevClient, monthlyQuota: 1000 });

    const res = await app.request("/api/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: "fake-token" }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ sessionToken: expect.any(String) });
  });

  it("rejects a Google token that fails verification", async () => {
    const rejecting: GoogleTokenVerifier = { verify: async () => Promise.reject(new Error("invalid")) };
    const app = createApp({ db: handle.db, googleVerifier: rejecting, jevClient: fakeJevClient, monthlyQuota: 1000 });

    const res = await app.request("/api/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: "bad-token" }),
    });

    expect(res.status).toBe(401);
  });

  it("rejects /api/classify without a session", async () => {
    const app = createApp({ db: handle.db, googleVerifier: fakeVerifier, jevClient: fakeJevClient, monthlyQuota: 1000 });

    const res = await app.request("/api/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId: "v1", videoTitle: "t", comments: [] }),
    });

    expect(res.status).toBe(401);
  });

  it("classifies new comments using Jev and consumes quota", async () => {
    const app = createApp({ db: handle.db, googleVerifier: fakeVerifier, jevClient: fakeJevClient, monthlyQuota: 1000 });
    const sessionToken = await login(app);

    const res = await app.request("/api/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({
        videoId: "v1",
        videoTitle: "t",
        comments: [
          { id: "c1", text: "hola" },
          { id: "c2", text: "mundo" },
        ],
      }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      results: [
        { commentId: "c1", category: "negativo", confidence: 0.82 },
        { commentId: "c2", category: "negativo", confidence: 0.82 },
      ],
    });
    expect(await getRemainingQuota(handle.db, fakeIdentity.googleSub, 1000)).toBe(998);
  });

  it("treats a low-confidence answer as sin_clasificar", async () => {
    const lowConfidence: JevClient = { classify: async () => ({ category: "toxico", confidence: 0.3 }) };
    const app = createApp({ db: handle.db, googleVerifier: fakeVerifier, jevClient: lowConfidence, monthlyQuota: 1000 });
    const sessionToken = await login(app);

    const res = await app.request("/api/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({ videoId: "v1", videoTitle: "t", comments: [{ id: "c1", text: "mmm" }] }),
    });

    expect(await res.json()).toEqual({ results: [{ commentId: "c1", category: "sin_clasificar", confidence: 0.3 }] });
  });

  it("treats a Jev failure (after retries) as sin_clasificar instead of failing the request", async () => {
    const failing: JevClient = { classify: async () => Promise.reject(new Error("Jev respondió con el estado 500")) };
    const app = createApp({ db: handle.db, googleVerifier: fakeVerifier, jevClient: failing, monthlyQuota: 1000 });
    const sessionToken = await login(app);

    const res = await app.request("/api/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({ videoId: "v1", videoTitle: "t", comments: [{ id: "c1", text: "mmm" }] }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ results: [{ commentId: "c1", category: "sin_clasificar", confidence: 0 }] });
  });

  it("does not spend quota again or call Jev for a comment that's already cached", async () => {
    let callCount = 0;
    const countingJevClient: JevClient = {
      classify: async () => {
        callCount += 1;
        return { category: "negativo", confidence: 0.82 };
      },
    };
    const app = createApp({ db: handle.db, googleVerifier: fakeVerifier, jevClient: countingJevClient, monthlyQuota: 1000 });
    const sessionToken = await login(app);
    const request = {
      method: "POST" as const,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({ videoId: "v1", videoTitle: "t", comments: [{ id: "c1", text: "hola" }] }),
    };

    await app.request("/api/classify", request);
    await app.request("/api/classify", request);

    expect(callCount).toBe(1);
    expect(await getRemainingQuota(handle.db, fakeIdentity.googleSub, 1000)).toBe(999);
  });

  it("returns 402 once the monthly quota is exhausted", async () => {
    const app = createApp({ db: handle.db, googleVerifier: fakeVerifier, jevClient: fakeJevClient, monthlyQuota: 1 });
    const sessionToken = await login(app);
    const classify = (comments: Array<{ id: string; text: string }>) =>
      app.request("/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ videoId: "v1", videoTitle: "t", comments }),
      });

    const first = await classify([{ id: "c1", text: "hola" }]);
    expect(first.status).toBe(200);

    const second = await classify([{ id: "c2", text: "mundo" }]);
    expect(second.status).toBe(402);
  });

  it("records a correction without touching quota", async () => {
    const app = createApp({ db: handle.db, googleVerifier: fakeVerifier, jevClient: fakeJevClient, monthlyQuota: 1000 });
    const sessionToken = await login(app);

    const res = await app.request("/api/corrections", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({
        commentId: "c1",
        originalCategory: "toxico",
        correctedCategory: "negativo",
        modelVersion: "jev-1.13.0",
      }),
    });

    expect(res.status).toBe(201);
    expect(await getRemainingQuota(handle.db, fakeIdentity.googleSub, 1000)).toBe(1000);
  });

  it("rejects /api/corrections without a session", async () => {
    const app = createApp({ db: handle.db, googleVerifier: fakeVerifier, jevClient: fakeJevClient, monthlyQuota: 1000 });

    const res = await app.request("/api/corrections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        commentId: "c1",
        originalCategory: "toxico",
        correctedCategory: "negativo",
        modelVersion: "jev-1.13.0",
      }),
    });

    expect(res.status).toBe(401);
  });

  it("rejects an invalid category in a correction", async () => {
    const app = createApp({ db: handle.db, googleVerifier: fakeVerifier, jevClient: fakeJevClient, monthlyQuota: 1000 });
    const sessionToken = await login(app);

    const res = await app.request("/api/corrections", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({
        commentId: "c1",
        originalCategory: "no-existe",
        correctedCategory: "negativo",
        modelVersion: "jev-1.13.0",
      }),
    });

    expect(res.status).toBe(400);
  });
});
