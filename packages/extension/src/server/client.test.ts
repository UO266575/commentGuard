import { beforeEach, describe, expect, it, vi } from "vitest";
import { classifyComments, loginWithGoogle, QuotaExceededError, recordCorrection, UnauthenticatedError } from "./client";
import type { ProxyFetchResponse } from "./messages";

function stubSendMessage(response: ProxyFetchResponse) {
  const sendMessage = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("chrome", { runtime: { sendMessage } });
  return sendMessage;
}

function proxied(status: number, body: unknown): ProxyFetchResponse {
  return { ok: true, status, bodyText: JSON.stringify(body) };
}

describe("server client (relayed through the background script)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("loginWithGoogle resolves with the session token on success", async () => {
    stubSendMessage(proxied(200, { sessionToken: "s1" }));

    await expect(loginWithGoogle("access-token")).resolves.toBe("s1");
  });

  it("loginWithGoogle throws UnauthenticatedError on a non-2xx status", async () => {
    stubSendMessage(proxied(401, { error: "nope" }));

    await expect(loginWithGoogle("access-token")).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it("classifyComments resolves with the parsed response on success", async () => {
    const results = { results: [{ commentId: "c1", category: "positivo", confidence: 0.9 }] };
    stubSendMessage(proxied(200, results));

    await expect(classifyComments("session", { videoId: "v1", videoTitle: "t", comments: [] })).resolves.toEqual(results);
  });

  it("classifyComments throws UnauthenticatedError on 401", async () => {
    stubSendMessage(proxied(401, {}));

    await expect(classifyComments("session", { videoId: "v1", videoTitle: "t", comments: [] })).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
  });

  it("classifyComments throws QuotaExceededError on 402", async () => {
    stubSendMessage(proxied(402, {}));

    await expect(classifyComments("session", { videoId: "v1", videoTitle: "t", comments: [] })).rejects.toBeInstanceOf(
      QuotaExceededError,
    );
  });

  it("recordCorrection resolves on success and rejects on 401", async () => {
    stubSendMessage(proxied(201, { status: "ok" }));
    await expect(
      recordCorrection("session", { commentId: "c1", originalCategory: "toxico", correctedCategory: "negativo", modelVersion: "v1" }),
    ).resolves.toBeUndefined();

    stubSendMessage(proxied(401, {}));
    await expect(
      recordCorrection("session", { commentId: "c1", originalCategory: "toxico", correctedCategory: "negativo", modelVersion: "v1" }),
    ).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it("surfaces a background relay failure (e.g. the server being unreachable)", async () => {
    stubSendMessage({ ok: false, error: "network down" });

    await expect(loginWithGoogle("access-token")).rejects.toThrow("No se pudo contactar con el servidor");
  });
});
