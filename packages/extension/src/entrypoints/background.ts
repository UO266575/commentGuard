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
  //
  // Generous timeout because the server can be a free-tier host (e.g. Render's free
  // plan) that sleeps after inactivity and takes up to ~a minute to wake back up on the
  // first request — without this, a genuinely dead server would otherwise hang the
  // request forever instead of eventually failing.
  const FETCH_TIMEOUT_MS = 90_000;

  chrome.runtime.onMessage.addListener((message: ProxyFetchMessage, _sender, sendResponse) => {
    if (message?.type !== PROXY_FETCH) return false;

    fetch(message.url, {
      method: message.method,
      headers: message.headers,
      body: message.body,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
      .then(async (res) => {
        const response: ProxyFetchResponse = { ok: true, status: res.status, bodyText: await res.text() };
        sendResponse(response);
      })
      .catch((error: unknown) => {
        const timedOut = error instanceof Error && error.name === "TimeoutError";
        const response: ProxyFetchResponse = {
          ok: false,
          error: timedOut
            ? "El servidor ha tardado demasiado en responder (más de 90 segundos). Puede estar caído."
            : error instanceof Error
              ? error.message
              : String(error),
        };
        sendResponse(response);
      });

    return true;
  });
});
