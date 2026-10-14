import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabase, type DatabaseHandle } from "../db/client.js";
import { testDatabaseUrl, truncateAll } from "../db/test-db.js";
import { findOrCreateUser } from "../users/repository.js";
import { consumeQuota, getRemainingQuota } from "./repository.js";

const url = testDatabaseUrl();

describe.skipIf(!url)("quota repository", () => {
  let handle: DatabaseHandle;

  beforeAll(() => {
    handle = createDatabase(url!);
  });

  beforeEach(async () => {
    await truncateAll(handle);
    await findOrCreateUser(handle.db, { googleSub: "u1", email: "u1@example.com" });
  });

  afterAll(() => handle.close());

  it("returns the full monthly limit when nothing has been consumed", async () => {
    expect(await getRemainingQuota(handle.db, "u1", 100)).toBe(100);
  });

  it("decreases the remaining quota as it's consumed", async () => {
    await consumeQuota(handle.db, "u1", 30);
    await consumeQuota(handle.db, "u1", 20);

    expect(await getRemainingQuota(handle.db, "u1", 100)).toBe(50);
  });

  it("tracks quota separately per calendar month", async () => {
    await consumeQuota(handle.db, "u1", 90, new Date("2026-01-15T00:00:00Z"));

    expect(await getRemainingQuota(handle.db, "u1", 100, new Date("2026-01-20T00:00:00Z"))).toBe(10);
    expect(await getRemainingQuota(handle.db, "u1", 100, new Date("2026-02-01T00:00:00Z"))).toBe(100);
  });

  it("never returns a negative remaining quota", async () => {
    await consumeQuota(handle.db, "u1", 150);

    expect(await getRemainingQuota(handle.db, "u1", 100)).toBe(0);
  });
});
