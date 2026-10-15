// chrome.identity is only available to the extension's privileged contexts (background
// service worker, popup, options page) — NOT to content scripts, even with the
// "identity" permission granted. Confirmed the hard way: calling it directly from the
// content script throws "Cannot read properties of undefined (reading 'getAuthToken')"
// because `chrome.identity` itself is undefined there. So the content script asks the
// background script to do it instead, over chrome.runtime messaging (which IS available
// to content scripts).
export const REQUEST_GOOGLE_TOKEN = "commentguard:request-google-token";

export interface RequestGoogleTokenMessage {
  type: typeof REQUEST_GOOGLE_TOKEN;
  interactive: boolean;
}

export type RequestGoogleTokenResponse = { ok: true; token: string } | { ok: false; error: string };
