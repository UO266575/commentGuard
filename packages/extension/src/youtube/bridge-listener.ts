import { BRIDGE_DATA_EVENT } from "./bridge-events";
import type { BridgeData } from "./bridge-data";

// Caches the data the MAIN-world page bridge dispatches, so waitForBridgeData() works
// whether it's called before or after the event actually fires.
let cachedBridgeData: BridgeData | null = null;
let waiters: Array<(data: BridgeData) => void> = [];

document.addEventListener(BRIDGE_DATA_EVENT, (event) => {
  cachedBridgeData = (event as CustomEvent<BridgeData>).detail;
  const toResolve = waiters;
  waiters = [];
  for (const resolve of toResolve) resolve(cachedBridgeData);
});

export function waitForBridgeData(timeoutMs = 8000): Promise<BridgeData> {
  if (cachedBridgeData) return Promise.resolve(cachedBridgeData);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      waiters = waiters.filter((waiter) => waiter !== onData);
      reject(new Error("No se pudo leer la configuración de YouTube a tiempo."));
    }, timeoutMs);

    function onData(data: BridgeData) {
      clearTimeout(timer);
      resolve(data);
    }

    waiters.push(onData);
  });
}

// Test-only: clears the module-level cache between test cases.
export function resetBridgeDataForTests(): void {
  cachedBridgeData = null;
  waiters = [];
}
