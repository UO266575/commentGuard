import { render } from "preact";
import { App } from "../ui/App";
import "../ui/styles.css";
import { fetchTopLevelComments } from "../youtube/comments-api";
import { waitForBridgeData } from "../youtube/bridge-listener";

// YouTube gives the comments section a stable `id="comments"` regardless of which
// element it's attached to (verified against a live watch page on 2026-10-14), so that's
// the one thing we anchor on instead of a longer, more change-prone selector chain.
const COMMENTS_ANCHOR = "#comments";

async function* fetchComments() {
  const bridgeData = await waitForBridgeData();
  if (!bridgeData.initialContinuation) {
    throw new Error("No se encontró la sección de comentarios de este vídeo.");
  }

  yield* fetchTopLevelComments({
    apiKey: bridgeData.apiKey,
    context: bridgeData.context,
    initialContinuation: bridgeData.initialContinuation,
  });
}

export default defineContentScript({
  matches: ["*://www.youtube.com/watch*"],
  cssInjectionMode: "ui",
  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: "commentguard-root",
      position: "inline",
      anchor: COMMENTS_ANCHOR,
      append: "before",
      onMount: (uiContainer) => {
        const anchor = document.querySelector<HTMLElement>(COMMENTS_ANCHOR);
        anchor?.style.setProperty("display", "none");

        render(
          <App
            onUnfiltered={() => {
              anchor?.style.removeProperty("display");
              ui.remove();
            }}
            fetchComments={fetchComments}
          />,
          uiContainer,
        );

        return uiContainer;
      },
      onRemove: (uiContainer) => {
        if (uiContainer) render(null, uiContainer);
      },
    });

    ui.autoMount();
  },
});
