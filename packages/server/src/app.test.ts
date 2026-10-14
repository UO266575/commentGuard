import { describe, expect, it } from "vitest";
import type { Database } from "./db/client.js";
import type { GoogleTokenVerifier } from "./auth/google.js";
import { createApp } from "./app.js";

// /health touches neither the database nor Google, so a real dependency isn't needed —
// the heavier auth/classify flow is covered against a real Postgres in
// app.integration.test.ts instead.
function buildApp() {
  const db = {} as Database;
  const googleVerifier: GoogleTokenVerifier = { verify: () => Promise.reject(new Error("not used")) };
  return createApp({ db, googleVerifier, monthlyQuota: 1000 });
}

describe("GET /health", () => {
  it("reports ok", async () => {
    const res = await buildApp().request("/health");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});
