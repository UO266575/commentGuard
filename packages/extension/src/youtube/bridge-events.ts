// MAIN-world and ISOLATED-world content scripts run in separate JS contexts and can't share
// variables, but they share the same DOM, so a CustomEvent on `document` is the bridge.
export const BRIDGE_DATA_EVENT = "commentguard:bridge-data";
