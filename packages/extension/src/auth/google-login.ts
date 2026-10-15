// Chrome-only (docs/ESPECIFICACION.md: "solo en Chrome de escritorio"), so this calls the
// raw chrome.identity API rather than a cross-browser polyfill.
//
// getAuthToken returns an OAuth2 ACCESS token, not an id_token — the server verifies it
// against Google's tokeninfo endpoint (see packages/server/src/auth/google.ts) rather than
// decoding it as a JWT locally. Needs a real client id registered in Google Cloud Console
// for this extension's actual id — see wxt.config.ts's manifest.key/oauth2 setup.
export async function requestGoogleAccessToken(interactive: boolean): Promise<string> {
  let token: string | undefined;

  try {
    ({ token } = await chrome.identity.getAuthToken({ interactive }));
  } catch (error) {
    // Chrome doesn't document a stable error string for "no Google account in this
    // Chrome profile" (the most common cause here), so every failure gets the same
    // actionable message instead of surfacing Chrome's raw, sometimes-cryptic text to the
    // end user — but it's still logged for debugging, since Chrome's real message (e.g.
    // "OAuth2 not granted or revoked", a bad client_id, a consent-screen test-user
    // restriction...) is the fastest way to tell these apart.
    console.error("[CommentGuard] chrome.identity.getAuthToken failed:", error);
    throw new Error(
      "No se pudo iniciar sesión con Google. Comprueba que has añadido una cuenta de Google a Chrome e inténtalo de nuevo.",
      { cause: error },
    );
  }

  if (!token) {
    throw new Error("No se pudo iniciar sesión con Google. Comprueba que has añadido una cuenta de Google a Chrome e inténtalo de nuevo.");
  }

  return token;
}
