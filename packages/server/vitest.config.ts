import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Repository tests share one real Postgres instance and truncate tables between
    // cases; running test files in parallel would let one file's truncate wipe out rows
    // another file is mid-test with.
    fileParallelism: false,
  },
});
