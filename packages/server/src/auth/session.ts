import { jwtVerify, SignJWT } from "jose";
import { getSessionSecret } from "../env.js";

const ALGORITHM = "HS256";

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(googleSub: string, secret = getSessionSecret()): Promise<string> {
  return new SignJWT({ sub: googleSub })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey(secret));
}

export async function verifySessionToken(token: string, secret = getSessionSecret()): Promise<string> {
  const { payload } = await jwtVerify(token, secretKey(secret), { algorithms: [ALGORITHM] });

  if (typeof payload.sub !== "string") throw new Error("Token de sesión inválido.");
  return payload.sub;
}
