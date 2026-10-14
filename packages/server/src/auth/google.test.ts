import { describe, expect, it, vi } from "vitest";
import { createGoogleTokenVerifier } from "./google.js";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("createGoogleTokenVerifier", () => {
  it("returns the identity when tokeninfo confirms it was issued to our client", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { aud: "our-client-id", sub: "sub-1", email: "a@example.com" }));
    const verifier = createGoogleTokenVerifier("our-client-id", fetchImpl);

    await expect(verifier.verify("token")).resolves.toEqual({ googleSub: "sub-1", email: "a@example.com" });
  });

  it("rejects a token issued to a different OAuth client", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, { aud: "someone-elses-client-id", sub: "sub-1", email: "a@example.com" }),
    );
    const verifier = createGoogleTokenVerifier("our-client-id", fetchImpl);

    await expect(verifier.verify("token")).rejects.toThrow();
  });

  it("rejects when Google reports the token as invalid", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(400, { error: "invalid_token" }));
    const verifier = createGoogleTokenVerifier("our-client-id", fetchImpl);

    await expect(verifier.verify("token")).rejects.toThrow();
  });
});
