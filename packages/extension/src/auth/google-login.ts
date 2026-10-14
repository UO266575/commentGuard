// Chrome-only (docs/ESPECIFICACION.md: "solo en Chrome de escritorio"), so this calls the
// raw chrome.identity API rather than a cross-browser polyfill.
//
// getAuthToken returns an OAuth2 ACCESS token, not an id_token — the server verifies it
// against Google's tokeninfo endpoint (see packages/server/src/auth/google.ts) rather than
// decoding it as a JWT locally. Needs a real client id registered in Google Cloud Console
// for this extension's actual id — see wxt.config.ts's manifest.oauth2 placeholder.
export async function requestGoogleAccessToken(interactive: boolean): Promise<string> {
  const { token } = await chrome.identity.getAuthToken({ interactive });
  if (!token) throw new Error("No se pudo iniciar sesión con Google.");
  return token;
}
