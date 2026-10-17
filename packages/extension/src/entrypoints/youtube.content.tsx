import { render } from "preact";
import { classifyVideoComments, fetchCommentReplies, submitCorrection } from "../classification/pipeline";
import { App } from "../ui/App";
import { watchYouTubeTheme } from "../ui/theme";
import "../ui/styles.css";

// YouTube gives the comments section a stable `id="comments"` regardless of which
// element it's attached to (verified against a live watch page on 2026-10-14), so that's
// the one thing we anchor on instead of a longer, more change-prone selector chain.
const COMMENTS_ANCHOR = "#comments";

function currentVideoId(): string {
  return new URL(location.href).searchParams.get("v") ?? "";
}

function currentVideoTitle(): string {
  return document.title.replace(/ - YouTube$/, "");
}

interface Mounted {
  uiContainer: HTMLElement;
  stopWatchingTheme: () => void;
}

export default defineContentScript({
  matches: ["*://www.youtube.com/watch*"],
  cssInjectionMode: "ui",
  async main(ctx) {
    const ui = await createShadowRootUi<Mounted>(ctx, {
      name: "commentguard-root",
      position: "inline",
      anchor: COMMENTS_ANCHOR,
      append: "before",
      onMount: (uiContainer, _shadow, shadowHost) => {
        const anchor = document.querySelector<HTMLElement>(COMMENTS_ANCHOR);
        anchor?.style.setProperty("display", "none");

        const stopWatchingTheme = watchYouTubeTheme((isDark) => {
          shadowHost.setAttribute("data-theme", isDark ? "dark" : "light");
        });

        render(
          <App
            onUnfiltered={() => {
              anchor?.style.removeProperty("display");
              ui.remove();
            }}
            fetchClassifiedComments={(continuation) => classifyVideoComments(currentVideoId(), currentVideoTitle(), continuation)}
            fetchReplies={fetchCommentReplies}
            submitCorrection={submitCorrection}
          />,
          uiContainer,
        );

        return { uiContainer, stopWatchingTheme };
      },
      onRemove: (mounted) => {
        if (!mounted) return;
        mounted.stopWatchingTheme();
        render(null, mounted.uiContainer);
      },
    });

    ui.autoMount();

    // YouTube is a single-page app: clicking through to another video reuses the same
    // #comments element instead of removing and recreating it (verified live via
    // claude-in-chrome — a marker attribute set on it survives SPA navigation), so
    // autoMount's anchor-presence watcher never sees it disappear/reappear and never
    // remounts. Without this, the App instance (and its "which video" closures) would
    // keep showing the previous video's comments and tab/filter selection until a full
    // page reload. `wxt:locationchange` is WXT's own SPA-navigation signal for exactly
    // this case; removing and re-auto-mounting forces a fresh onRemove/onMount cycle
    // (the anchor already exists, so autoMount's mount() runs immediately and
    // synchronously) which resets the App to its initial state for the new video.
    let lastVideoId = currentVideoId();
    ctx.addEventListener(window, "wxt:locationchange", () => {
      const videoId = currentVideoId();
      if (videoId === lastVideoId) return;
      lastVideoId = videoId;
      ui.remove();
      ui.autoMount();
    });
  },
});
