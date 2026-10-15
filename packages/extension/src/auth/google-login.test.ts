import { beforeEach, describe, expect, it, vi } from "vitest";
import { requestGoogleAccessToken } from "./google-login";
import { REQUEST_GOOGLE_TOKEN, type RequestGoogleTokenResponse } from "./messages";

function stubSendMessage(response: RequestGoogleTokenResponse) {
  const sendMessage = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("chrome", { runtime: { sendMessage } });
  return sendMessage;
}

describe("requestGoogleAccessToken", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("asks the background script for a token and resolves with it", async () => {
    const sendMessage = stubSendMessage({ ok: true, token: "abc-123" });

    await expect(requestGoogleAccessToken(true)).resolves.toBe("abc-123");
    expect(sendMessage).toHaveBeenCalledWith({ type: REQUEST_GOOGLE_TOKEN, interactive: true });
  });

  it("throws an actionable error when the background script reports failure", async () => {
    stubSendMessage({ ok: false, error: "Cannot read properties of undefined (reading 'getAuthToken')" });

    await expect(requestGoogleAccessToken(true)).rejects.toThrow("No se pudo iniciar sesión con Google");
  });
});
