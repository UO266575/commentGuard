// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { formatTabCount } from "./App";
// jsdom is needed here because App.tsx transitively imports pipeline.ts ->
// bridge-listener.ts, which calls document.addEventListener at module load time.

describe("formatTabCount", () => {
  it("shows small counts as-is", () => {
    expect(formatTabCount(0)).toBe("0");
    expect(formatTabCount(5)).toBe("5");
    expect(formatTabCount(999)).toBe("999");
  });

  it("abbreviates thousands, dropping a trailing .0", () => {
    expect(formatTabCount(1000)).toBe("1k");
    expect(formatTabCount(1200)).toBe("1.2k");
    expect(formatTabCount(12345)).toBe("12.3k");
  });

  it("abbreviates millions the same way", () => {
    expect(formatTabCount(1_000_000)).toBe("1M");
    expect(formatTabCount(2_500_000)).toBe("2.5M");
  });
});
