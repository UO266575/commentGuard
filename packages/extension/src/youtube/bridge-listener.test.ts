// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { BRIDGE_DATA_EVENT } from "./bridge-events";
import { resetBridgeDataForTests, waitForBridgeData } from "./bridge-listener";
import type { BridgeData } from "./bridge-data";

const sample: BridgeData = { apiKey: "key", context: {}, initialContinuation: "token" };

function dispatch(data: BridgeData) {
  document.dispatchEvent(new CustomEvent(BRIDGE_DATA_EVENT, { detail: data }));
}

describe("waitForBridgeData", () => {
  afterEach(() => resetBridgeDataForTests());

  it("resolves once the bridge event fires", async () => {
    const promise = waitForBridgeData();
    dispatch(sample);

    await expect(promise).resolves.toEqual(sample);
  });

  it("resolves immediately with the cached value from a previous event", async () => {
    dispatch(sample);

    await expect(waitForBridgeData()).resolves.toEqual(sample);
  });

  it("rejects if no event arrives before the timeout", async () => {
    await expect(waitForBridgeData(10)).rejects.toThrow();
  });
});
