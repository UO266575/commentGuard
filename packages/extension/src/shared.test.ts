import { describe, expect, it } from "vitest";
import { CONFIDENCE_THRESHOLD } from "@comment-classificator/shared";

describe("shared constants", () => {
  it("are reachable from the extension package", () => {
    expect(CONFIDENCE_THRESHOLD).toBe(0.5);
  });
});
