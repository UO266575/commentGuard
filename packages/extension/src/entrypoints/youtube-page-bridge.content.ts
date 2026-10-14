import { findInitialCommentsContinuation, type BridgeData } from "../youtube/bridge-data";
import { BRIDGE_DATA_EVENT } from "../youtube/bridge-events";

// Runs in the page's own MAIN world (unlike youtube.content.ts) so it can read the
// `ytcfg`/`ytInitialData` globals YouTube's own scripts set on `window`. It never touches
// the DOM beyond dispatching one event, keeping the extension's footprint in the page
// context as small as possible.
interface YtCfg {
  get(key: "INNERTUBE_API_KEY"): string | undefined;
  get(key: "INNERTUBE_CONTEXT"): unknown;
}

declare global {
  interface Window {
    ytcfg?: YtCfg;
    ytInitialData?: unknown;
  }
}

function readBridgeData(): BridgeData | null {
  const apiKey = window.ytcfg?.get("INNERTUBE_API_KEY");
  const context = window.ytcfg?.get("INNERTUBE_CONTEXT");
  if (!apiKey || !context) return null;

  return {
    apiKey,
    context,
    initialContinuation: findInitialCommentsContinuation(window.ytInitialData),
  };
}

export default defineContentScript({
  matches: ["*://www.youtube.com/watch*"],
  world: "MAIN",
  main() {
    // `ytcfg`/`ytInitialData` are set by inline scripts that run before this content
    // script's default `documentIdle` timing, but YouTube's client-side navigation can
    // recreate them later, so keep retrying briefly instead of reading them exactly once.
    const attemptDispatch = () => {
      const data = readBridgeData();
      if (!data) return false;

      document.dispatchEvent(new CustomEvent<BridgeData>(BRIDGE_DATA_EVENT, { detail: data }));
      return true;
    };

    if (attemptDispatch()) return;

    let attempts = 0;
    const interval = setInterval(() => {
      attempts += 1;
      if (attemptDispatch() || attempts >= 20) clearInterval(interval);
    }, 250);
  },
});
