// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
// jsdom is needed here because pipeline.ts transitively imports bridge-listener.ts, which
// calls document.addEventListener at module load time.

vi.mock("../auth/google-login", () => ({
  requestGoogleAccessToken: vi.fn(),
}));
vi.mock("../auth/session-storage", () => ({
  getStoredSessionToken: vi.fn(),
  setStoredSessionToken: vi.fn(),
  clearStoredSessionToken: vi.fn(),
}));
vi.mock("../server/client", async () => {
  const actual = await vi.importActual<typeof import("../server/client")>("../server/client");
  return { ...actual, loginWithGoogle: vi.fn(), recordCorrection: vi.fn() };
});

import { requestGoogleAccessToken } from "../auth/google-login";
import { clearStoredSessionToken, getStoredSessionToken } from "../auth/session-storage";
import { loginWithGoogle, recordCorrection, UnauthenticatedError } from "../server/client";
import { submitCorrection } from "./pipeline";

const correction = { commentId: "c1", originalCategory: "toxico" as const, correctedCategory: "negativo" as const };

describe("withSession retry (exercised via submitCorrection)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // This is the exact bug reported in testing: a stale stored session token made the
  // "retry after 401" silently resend the SAME bad token and fail the same way, because
  // ensureSessionToken returns whatever's already in storage without re-authenticating.
  it("clears the stale stored token before retrying, instead of resending it", async () => {
    vi.mocked(getStoredSessionToken).mockResolvedValueOnce("stale-token").mockResolvedValueOnce(null);
    vi.mocked(requestGoogleAccessToken).mockResolvedValue("access-token");
    vi.mocked(loginWithGoogle).mockResolvedValue("fresh-token");
    vi.mocked(recordCorrection).mockRejectedValueOnce(new UnauthenticatedError("expired")).mockResolvedValueOnce(undefined);

    await submitCorrection(correction);

    expect(clearStoredSessionToken).toHaveBeenCalledTimes(1);
    expect(recordCorrection).toHaveBeenNthCalledWith(1, "stale-token", expect.objectContaining({ commentId: "c1" }));
    expect(recordCorrection).toHaveBeenNthCalledWith(2, "fresh-token", expect.objectContaining({ commentId: "c1" }));
  });

  it("does not retry or touch storage for a non-auth error", async () => {
    vi.mocked(getStoredSessionToken).mockResolvedValue("token");
    vi.mocked(recordCorrection).mockRejectedValue(new Error("boom"));

    await expect(submitCorrection(correction)).rejects.toThrow("boom");

    expect(clearStoredSessionToken).not.toHaveBeenCalled();
    expect(recordCorrection).toHaveBeenCalledTimes(1);
  });
});
