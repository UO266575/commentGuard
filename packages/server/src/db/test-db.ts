import { sql } from "drizzle-orm";
import type { DatabaseHandle } from "./client.js";

// Repository tests hit a real Postgres instead of mocking the query builder, since the
// interesting bugs here live in constraints, upserts and date filtering that a mock would
// paper over. They're skipped (not failed) when DATABASE_URL isn't set — see docker-compose.yml
// for local dev, and .github/workflows/ci.yml for the CI service container.
export function testDatabaseUrl(): string | undefined {
  return process.env["DATABASE_URL"];
}

export async function truncateAll(handle: DatabaseHandle): Promise<void> {
  await handle.db.execute(
    sql`TRUNCATE TABLE quota_usage, comment_classification_cache, users RESTART IDENTITY CASCADE`,
  );
}
