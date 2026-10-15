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
  },
});
