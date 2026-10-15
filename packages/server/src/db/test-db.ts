import { sql } from "drizzle-orm";
import type { DatabaseHandle } from "./client.js";

// Repository tests hit a real Postgres instead of mocking the query builder, since the
// interesting bugs here live in constraints, upserts and date filtering that a mock would
// paper over. Deliberately a SEPARATE variable from DATABASE_URL: these tests truncate
// every table between cases, and running them against the same database a `pnpm dev`
// server is using wipes real session data out from under it mid-use (see docker-compose.yml
// for the local "_test" database, and .github/workflows/ci.yml for the CI service
// container, where DATABASE_URL and TEST_DATABASE_URL point at the same disposable instance).
// Skipped (not failed) when unset.
export function testDatabaseUrl(): string | undefined {
  return process.env["TEST_DATABASE_URL"];
}

export async function truncateAll(handle: DatabaseHandle): Promise<void> {
  await handle.db.execute(
    sql`TRUNCATE TABLE quota_usage, comment_classification_cache, comment_corrections, users RESTART IDENTITY CASCADE`,
  );
}
