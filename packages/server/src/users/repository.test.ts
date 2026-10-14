import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabase, type DatabaseHandle } from "../db/client.js";
import { testDatabaseUrl, truncateAll } from "../db/test-db.js";
import { findOrCreateUser } from "./repository.js";

const url = testDatabaseUrl();

describe.skipIf(!url)("findOrCreateUser", () => {
  let handle: DatabaseHandle;

  beforeAll(() => {
    handle = createDatabase(url!);
  });

  beforeEach(() => truncateAll(handle));

  afterAll(() => handle.close());

  it("creates a new user on first login", async () => {
    const user = await findOrCreateUser(handle.db, { googleSub: "sub-1", email: "a@example.com" });

    expect(user).toMatchObject({ googleSub: "sub-1", email: "a@example.com" });
  });

  it("updates the stored email on a repeated login", async () => {
    await findOrCreateUser(handle.db, { googleSub: "sub-1", email: "old@example.com" });
    const updated = await findOrCreateUser(handle.db, { googleSub: "sub-1", email: "new@example.com" });

    expect(updated.email).toBe("new@example.com");
  });
});
