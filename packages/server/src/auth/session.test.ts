import { describe, expect, it } from "vitest";
import { createSessionToken, verifySessionToken } from "./session.js";

const SECRET = "test-secret-at-least-32-bytes-long!!";

describe("session tokens", () => {
  it("round-trips the Google subject through sign and verify", async () => {
    const token = await createSessionToken("google-sub-123", SECRET);

    await expect(verifySessionToken(token, SECRET)).resolves.toBe("google-sub-123");
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createSessionToken("google-sub-123", SECRET);

    await expect(verifySessionToken(token, "a-completely-different-secret!!")).rejects.toThrow();
  });

  it("rejects garbage input", async () => {
    await expect(verifySessionToken("not-a-jwt", SECRET)).rejects.toThrow();
  });
});
