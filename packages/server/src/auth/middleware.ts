import { eq } from "drizzle-orm";
import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../app-env.js";
import type { Database } from "../db/client.js";
import { users } from "../db/schema.js";
import { verifySessionToken } from "./session.js";

const BEARER_PREFIX = "Bearer ";

// Takes `db` so it can confirm the user a session token names still exists — a valid JWT
// signature alone doesn't guarantee that (e.g. the user row could have been removed after
// the token was issued). Without this check, routes that reference userGoogleSub as a
// foreign key (quota, corrections) fail with an unhandled 500 instead of a clean 401 that
// the extension already knows how to recover from (see pipeline.ts's withSession, which
// re-authenticates once on 401).
export function createRequireSession(db: Database): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const header = c.req.header("Authorization");
    const token = header?.startsWith(BEARER_PREFIX) ? header.slice(BEARER_PREFIX.length) : undefined;

    if (!token) return c.json({ error: "Falta la sesión." }, 401);

    let googleSub: string;
    try {
      googleSub = await verifySessionToken(token);
    } catch {
      return c.json({ error: "Sesión inválida o caducada." }, 401);
    }

    const [user] = await db.select({ googleSub: users.googleSub }).from(users).where(eq(users.googleSub, googleSub));
    if (!user) return c.json({ error: "Sesión inválida o caducada." }, 401);

    c.set("userGoogleSub", googleSub);
    await next();
  };
}
