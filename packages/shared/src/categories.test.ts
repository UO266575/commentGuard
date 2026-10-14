import { describe, expect, it } from "vitest";
import { CATEGORIES, TABS, UNCLASSIFIED, isCategory, isTab } from "./categories";

describe("categories", () => {
  it("has exactly the six fixed categories", () => {
    expect(CATEGORIES).toHaveLength(6);
  });

  it("orders the tabs as specified, ending with sin_clasificar", () => {
    expect(TABS.map((tab) => tab.id)).toEqual([
      "positivo",
      "constructivo",
      "neutral",
      "irrelevante",
      "negativo",
      "toxico",
      UNCLASSIFIED,
    ]);
  });

  it("recognizes categories and the unclassified tab", () => {
    expect(isCategory("positivo")).toBe(true);
    expect(isCategory(UNCLASSIFIED)).toBe(false);
    expect(isTab(UNCLASSIFIED)).toBe(true);
    expect(isTab("otra_cosa")).toBe(false);
  });
});
