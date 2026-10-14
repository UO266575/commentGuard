import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabase, type DatabaseHandle } from "../db/client.js";
import { commentCorrections } from "../db/schema.js";
import { testDatabaseUrl, truncateAll } from "../db/test-db.js";
import { recordCorrection } from "./repository.js";

const url = testDatabaseUrl();

describe.skipIf(!url)("recordCorrection", () => {
  let handle: DatabaseHandle;

  beforeAll(() => {
    handle = createDatabase(url!);
  });

  beforeEach(() => truncateAll(handle));

  afterAll(() => handle.close());

  it("stores a correction row for the comment", async () => {
    await recordCorrection(handle.db, {
      commentId: "c1",
      originalCategory: "toxico",
      correctedCategory: "negativo",
      modelVersion: "jev-1.13.0",
    });

    const rows = await handle.db.select().from(commentCorrections).where(eq(commentCorrections.commentId, "c1"));

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      commentId: "c1",
      originalCategory: "toxico",
      correctedCategory: "negativo",
      modelVersion: "jev-1.13.0",
    });
  });

  it("keeps multiple corrections for the same comment as separate rows", async () => {
    await recordCorrection(handle.db, {
      commentId: "c1",
      originalCategory: "toxico",
      correctedCategory: "negativo",
      modelVersion: "jev-1.13.0",
    });
    await recordCorrection(handle.db, {
      commentId: "c1",
      originalCategory: "negativo",
      correctedCategory: "neutral",
      modelVersion: "jev-1.13.0",
    });

    const rows = await handle.db.select().from(commentCorrections).where(eq(commentCorrections.commentId, "c1"));

    expect(rows).toHaveLength(2);
  });
});
