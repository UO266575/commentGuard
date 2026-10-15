import { REQUEST_GOOGLE_TOKEN, type RequestGoogleTokenMessage, type RequestGoogleTokenResponse } from "../auth/messages";

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
});
