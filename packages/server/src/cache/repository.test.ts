import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabase, type DatabaseHandle } from "../db/client.js";
import { testDatabaseUrl, truncateAll } from "../db/test-db.js";
import { deleteExpiredCacheEntries, getCachedClassifications, storeClassifications } from "./repository.js";

const url = testDatabaseUrl();
const SIXTY_ONE_DAYS_MS = 61 * 24 * 60 * 60 * 1000;

describe.skipIf(!url)("cache repository", () => {
  let handle: DatabaseHandle;

  beforeAll(() => {
    handle = createDatabase(url!);
  });

  beforeEach(() => truncateAll(handle));

  afterAll(() => handle.close());

  it("returns nothing for comments that were never cached", async () => {
    const result = await getCachedClassifications(handle.db, ["missing"]);

    expect(result.size).toBe(0);
  });

  it("stores and retrieves a classification by comment id", async () => {
    await storeClassifications(handle.db, [
      { commentId: "c1", category: "positivo", confidence: 0.9, modelVersion: "jev-1.13.0" },
    ]);

    const result = await getCachedClassifications(handle.db, ["c1"]);

    expect(result.get("c1")).toMatchObject({ category: "positivo", confidence: 0.9 });
  });

  it("overwrites an existing entry for the same comment id", async () => {
    await storeClassifications(handle.db, [
      { commentId: "c1", category: "positivo", confidence: 0.9, modelVersion: "jev-1.13.0" },
    ]);
    await storeClassifications(handle.db, [
      { commentId: "c1", category: "toxico", confidence: 0.6, modelVersion: "jev-1.14.0" },
    ]);

    const result = await getCachedClassifications(handle.db, ["c1"]);

    expect(result.get("c1")).toMatchObject({ category: "toxico", confidence: 0.6, modelVersion: "jev-1.14.0" });
  });

  it("treats entries older than the 60-day TTL as a cache miss", async () => {
    await storeClassifications(handle.db, [
      { commentId: "c1", category: "positivo", confidence: 0.9, modelVersion: "jev-1.13.0" },
    ]);

    const in61Days = new Date(Date.now() + SIXTY_ONE_DAYS_MS);
    const result = await getCachedClassifications(handle.db, ["c1"], in61Days);

    expect(result.size).toBe(0);
  });

  it("deletes entries older than the TTL", async () => {
    await storeClassifications(handle.db, [
      { commentId: "c1", category: "positivo", confidence: 0.9, modelVersion: "jev-1.13.0" },
    ]);

    const in61Days = new Date(Date.now() + SIXTY_ONE_DAYS_MS);
    const deletedCount = await deleteExpiredCacheEntries(handle.db, in61Days);

    expect(deletedCount).toBe(1);
  });
});
