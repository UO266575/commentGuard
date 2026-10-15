import { findInitialCommentsContinuation, type BridgeData } from "../youtube/bridge-data";
import { BRIDGE_DATA_EVENT } from "../youtube/bridge-events";

// Runs in the page's own MAIN world (unlike youtube.content.tsx) so it can read the
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

const REBROADCAST_ATTEMPTS = 20;
const REBROADCAST_INTERVAL_MS = 250;

export default defineContentScript({
  matches: ["*://www.youtube.com/watch*"],
  world: "MAIN",
  main() {
    // MAIN-world and ISOLATED-world content scripts for the same page are separate
    // injections with no guaranteed relative order — Chrome can (and, in practice,
    // reliably does on some loads) run this script and dispatch before
    // bridge-listener.ts's `document.addEventListener` in the isolated world has even
    // attached, and a CustomEvent dispatched to no listener is lost forever. So this
    // keeps re-broadcasting the same data for a few seconds instead of sending it once,
    // to land on whatever call-and-response timing the isolated side actually attaches at.
    let attempts = 0;

    const broadcast = () => {
      attempts += 1;

      const data = readBridgeData();
      if (data) {
        document.dispatchEvent(new CustomEvent<BridgeData>(BRIDGE_DATA_EVENT, { detail: data }));
      }

      if (attempts >= REBROADCAST_ATTEMPTS) clearInterval(interval);
    };

    broadcast();
    const interval = setInterval(broadcast, REBROADCAST_INTERVAL_MS);
  },
});
