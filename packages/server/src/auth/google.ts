import { OAuth2Client } from "google-auth-library";
import { getGoogleClientId } from "../env.js";

export interface GoogleIdentity {
  googleSub: string;
  email: string;
}

// Interface instead of a bare function so routes can inject a fake verifier in tests
// without making real calls to Google — see app.integration.test.ts.
export interface GoogleTokenVerifier {
  verify(idToken: string): Promise<GoogleIdentity>;
}

export function createGoogleTokenVerifier(clientId = getGoogleClientId()): GoogleTokenVerifier {
  const client = new OAuth2Client(clientId);

  return {
    async verify(idToken: string): Promise<GoogleIdentity> {
      const ticket = await client.verifyIdToken({ idToken, audience: clientId });
      const payload = ticket.getPayload();

      if (!payload?.sub || !payload.email) {
        throw new Error("El token de Google no incluye los datos esperados.");
      }

      return { googleSub: payload.sub, email: payload.email };
    },
  };
}
