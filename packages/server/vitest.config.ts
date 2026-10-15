import { defineConfig } from "vitest/config";

// Mirrors the --env-file-if-exists flag the dev/migrate scripts use (see package.json),
// so `pnpm test` also picks up packages/server/.env locally without it having to be
// exported by hand. Silently does nothing where there's no .env, e.g. in CI, which injects
// TEST_DATABASE_URL etc. directly as workflow env vars instead.
try {
  process.loadEnvFile(".env");
} catch {
  // no .env file — fine
}

export default defineConfig({
  test: {
    // Repository tests share one real Postgres instance and truncate tables between
    // cases; running test files in parallel would let one file's truncate wipe out rows
    // another file is mid-test with.
    fileParallelism: false,
  },
});
