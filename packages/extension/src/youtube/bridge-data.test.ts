import { describe, expect, it } from "vitest";
import { findInitialCommentsContinuation } from "./bridge-data";
import ytInitialDataSample from "./fixtures/yt-initial-data.sample.json";

describe("findInitialCommentsContinuation", () => {
  it("picks the selected sort option's continuation token", () => {
    expect(findInitialCommentsContinuation(ytInitialDataSample)).toBe("SAMPLE_TOP_SORT_TOKEN");
  });

  it("falls back to the first option when none is marked selected", () => {
    const withoutSelection = JSON.parse(JSON.stringify(ytInitialDataSample));
    withoutSelection.engagementPanels[0].engagementPanelSectionListRenderer.header
      .engagementPanelTitleHeaderRenderer.menu.sortFilterSubMenuRenderer.subMenuItems[0].selected = false;

    expect(findInitialCommentsContinuation(withoutSelection)).toBe("SAMPLE_TOP_SORT_TOKEN");
  });

  it("returns null when the comments panel is missing", () => {
    expect(findInitialCommentsContinuation({})).toBeNull();
  });
});
