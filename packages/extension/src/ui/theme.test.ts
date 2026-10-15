// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { watchYouTubeTheme } from "./theme";

describe("watchYouTubeTheme", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("dark");
  });

  it("reports light immediately when YouTube has no dark attribute", () => {
    const seen: boolean[] = [];
    const stop = watchYouTubeTheme((isDark) => seen.push(isDark));

    expect(seen).toEqual([false]);
    stop();
  });

  it("reports dark immediately when YouTube already has the dark attribute", () => {
    document.documentElement.setAttribute("dark", "");

    const seen: boolean[] = [];
    const stop = watchYouTubeTheme((isDark) => seen.push(isDark));

    expect(seen).toEqual([true]);
    stop();
  });

  it("reacts when YouTube toggles the attribute later", async () => {
    const seen: boolean[] = [];
    const stop = watchYouTubeTheme((isDark) => seen.push(isDark));

    document.documentElement.setAttribute("dark", "");
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(seen).toEqual([false, true]);
    stop();
  });

  it("stops observing once the returned cleanup function is called", async () => {
    const seen: boolean[] = [];
    const stop = watchYouTubeTheme((isDark) => seen.push(isDark));
    stop();

    document.documentElement.setAttribute("dark", "");
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(seen).toEqual([false]);
  });
});
