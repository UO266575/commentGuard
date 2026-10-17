import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabase, type DatabaseHandle } from "../db/client.js";
import { testDatabaseUrl, truncateAll } from "../db/test-db.js";
import { deleteExpiredCacheEntries, getCachedClassifications, storeClassifications } from "./repository.js";

const url = testDatabaseUrl();
const SIXTY_ONE_DAYS_MS = 61 * 24 * 60 * 60 * 1000;
const MODEL_VERSION = "jev-1.13.0+c2";

describe.skipIf(!url)("cache repository", () => {
  let handle: DatabaseHandle;

  beforeAll(() => {
    handle = createDatabase(url!);
  });

  beforeEach(() => truncateAll(handle));

  afterAll(() => handle.close());

  it("returns nothing for comments that were never cached", async () => {
    const result = await getCachedClassifications(handle.db, ["missing"], MODEL_VERSION);

    expect(result.size).toBe(0);
  });

  it("stores and retrieves a classification by comment id", async () => {
    await storeClassifications(handle.db, [{ commentId: "c1", category: "positivo", confidence: 0.9, modelVersion: MODEL_VERSION }]);

    const result = await getCachedClassifications(handle.db, ["c1"], MODEL_VERSION);

    expect(result.get("c1")).toMatchObject({ category: "positivo", confidence: 0.9 });
  });

  it("overwrites an existing entry for the same comment id", async () => {
    await storeClassifications(handle.db, [{ commentId: "c1", category: "positivo", confidence: 0.9, modelVersion: MODEL_VERSION }]);
    await storeClassifications(handle.db, [
      { commentId: "c1", category: "toxico", confidence: 0.6, modelVersion: "jev-1.14.0+c3" },
    ]);

    const result = await getCachedClassifications(handle.db, ["c1"], "jev-1.14.0+c3");

    expect(result.get("c1")).toMatchObject({ category: "toxico", confidence: 0.6, modelVersion: "jev-1.14.0+c3" });
  });

  it("treats entries older than the 60-day TTL as a cache miss", async () => {
    await storeClassifications(handle.db, [{ commentId: "c1", category: "positivo", confidence: 0.9, modelVersion: MODEL_VERSION }]);

    const in61Days = new Date(Date.now() + SIXTY_ONE_DAYS_MS);
    const result = await getCachedClassifications(handle.db, ["c1"], MODEL_VERSION, in61Days);

    expect(result.size).toBe(0);
  });

  // Regression: a change to CATEGORY_CRITERIA/instructions in jev/client.ts used to leave
  // comments classified under the old wording sitting in the cache for up to 60 days,
  // still showing the stale category. CRITERIA_VERSION (part of model_version) fixes
  // that: a fresh row from a different version is still a cache miss.
  it("treats an entry with a different model version as a cache miss, even if still fresh", async () => {
    await storeClassifications(handle.db, [
      { commentId: "c1", category: "negativo", confidence: 0.8, modelVersion: "jev-1.13.0+c1" },
    ]);

    const result = await getCachedClassifications(handle.db, ["c1"], "jev-1.13.0+c2");

    expect(result.size).toBe(0);
  });

  it("deletes entries older than the TTL", async () => {
    await storeClassifications(handle.db, [{ commentId: "c1", category: "positivo", confidence: 0.9, modelVersion: MODEL_VERSION }]);

    const in61Days = new Date(Date.now() + SIXTY_ONE_DAYS_MS);
    const deletedCount = await deleteExpiredCacheEntries(handle.db, in61Days);

    expect(deletedCount).toBe(1);
  });
});
