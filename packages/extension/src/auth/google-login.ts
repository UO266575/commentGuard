import { REQUEST_GOOGLE_TOKEN, type RequestGoogleTokenMessage, type RequestGoogleTokenResponse } from "./messages";

// Chrome-only (docs/ESPECIFICACION.md: "solo en Chrome de escritorio"). Asks the
// background script to call chrome.identity.getAuthToken() — see messages.ts for why this
// can't be called directly from a content script. Needs a real client id registered in
// Google Cloud Console for this extension's actual id — see wxt.config.ts's
// manifest.key/oauth2 setup.
export async function requestGoogleAccessToken(interactive: boolean): Promise<string> {
  const message: RequestGoogleTokenMessage = { type: REQUEST_GOOGLE_TOKEN, interactive };
  const response = (await chrome.runtime.sendMessage(message)) as RequestGoogleTokenResponse;

  if (!response?.ok) {
    // Chrome doesn't document a stable error string for "no Google account in this
    // Chrome profile" (the most common cause here), so every failure gets the same
    // actionable message instead of surfacing Chrome's raw, sometimes-cryptic text to the
    // end user — but it's still logged for debugging.
    console.error("[CommentGuard] background getAuthToken failed:", response?.error);
    throw new Error("No se pudo iniciar sesión con Google. Comprueba que has añadido una cuenta de Google a Chrome e inténtalo de nuevo.");
  }

  return response.token;
}
