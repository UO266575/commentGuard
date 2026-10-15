import { REQUEST_GOOGLE_TOKEN, type RequestGoogleTokenMessage, type RequestGoogleTokenResponse } from "../auth/messages";
import { PROXY_FETCH, type ProxyFetchMessage, type ProxyFetchResponse } from "../server/messages";

export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((message: RequestGoogleTokenMessage, _sender, sendResponse) => {
    if (message?.type !== REQUEST_GOOGLE_TOKEN) return false;

    chrome.identity
      .getAuthToken({ interactive: message.interactive })
      .then(({ token }) => {
        const response: RequestGoogleTokenResponse = token ? { ok: true, token } : { ok: false, error: "Chrome no devolvió ningún token." };
        sendResponse(response);
      })
      .catch((error: unknown) => {
        const response: RequestGoogleTokenResponse = {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
        sendResponse(response);
      });

    return true; // keep the message channel open for the async sendResponse above
  });

  // Relays fetch() calls to our own server: content scripts can never bypass CORS
  // (confirmed against Chrome's docs), but this background service worker can, as long
  // as the target is covered by host_permissions — see wxt.config.ts.
  chrome.runtime.onMessage.addListener((message: ProxyFetchMessage, _sender, sendResponse) => {
    if (message?.type !== PROXY_FETCH) return false;

    fetch(message.url, { method: message.method, headers: message.headers, body: message.body })
      .then(async (res) => {
        const response: ProxyFetchResponse = { ok: true, status: res.status, bodyText: await res.text() };
        sendResponse(response);
      })
      .catch((error: unknown) => {
        const response: ProxyFetchResponse = { ok: false, error: error instanceof Error ? error.message : String(error) };
        sendResponse(response);
      });

    return true;
  });
});
