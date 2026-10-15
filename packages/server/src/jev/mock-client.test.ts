import { describe, expect, it } from "vitest";
import { CATEGORIES } from "@comment-classificator/shared";
import { createMockJevClient } from "./mock-client.js";

describe("createMockJevClient", () => {
  it("always returns one of the fixed categories and a confidence in [0, 1)", async () => {
    const client = createMockJevClient();

    for (let i = 0; i < 20; i += 1) {
      const result = await client.classify({ videoTitle: "t", comment: "c" });
      expect(CATEGORIES).toContain(result.category);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThan(1);
    }
  });
});
