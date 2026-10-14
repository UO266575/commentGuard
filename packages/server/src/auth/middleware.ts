import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../app-env.js";
import { verifySessionToken } from "./session.js";

const BEARER_PREFIX = "Bearer ";

export const requireSession: MiddlewareHandler<AppEnv> = async (c, next) => {
  const header = c.req.header("Authorization");
  const token = header?.startsWith(BEARER_PREFIX) ? header.slice(BEARER_PREFIX.length) : undefined;

  if (!token) return c.json({ error: "Falta la sesión." }, 401);

  try {
    c.set("userGoogleSub", await verifySessionToken(token));
  } catch {
    return c.json({ error: "Sesión inválida o caducada." }, 401);
  }

  await next();
};
