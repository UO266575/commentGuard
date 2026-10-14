import { getGoogleClientId } from "../env.js";

export interface GoogleIdentity {
  googleSub: string;
  email: string;
}

// Interface instead of a bare function so routes can inject a fake verifier in tests
// without making real calls to Google — see app.integration.test.ts.
export interface GoogleTokenVerifier {
  verify(accessToken: string): Promise<GoogleIdentity>;
}

interface TokenInfoResponse {
  aud?: string;
  sub?: string;
  email?: string;
}

// The extension gets this token from chrome.identity.getAuthToken(), which returns an
// OAuth2 ACCESS token rather than an id_token — see
// packages/extension/src/auth/google-login.ts. tokeninfo both confirms the token is a
// genuine, currently-valid Google token AND that it was issued to this app's own OAuth
// client (the `aud` check), rather than some other app's token for the same user.
export function createGoogleTokenVerifier(
  clientId = getGoogleClientId(),
  fetchImpl: typeof fetch = fetch,
): GoogleTokenVerifier {
  return {
    async verify(accessToken: string): Promise<GoogleIdentity> {
      const url = `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`;
      const response = await fetchImpl(url);

      if (!response.ok) throw new Error("El token de Google no es válido.");

      const payload = (await response.json()) as TokenInfoResponse;
      if (payload.aud !== clientId) throw new Error("El token de Google no pertenece a esta aplicación.");
      if (!payload.sub || !payload.email) throw new Error("El token de Google no incluye los datos esperados.");

      return { googleSub: payload.sub, email: payload.email };
    },
  };
}
