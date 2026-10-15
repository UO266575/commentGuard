import type { ClassifyRequest, ClassifyResponse, CorrectionRequest } from "@comment-classificator/shared";
import { SERVER_BASE_URL } from "./config";
import { PROXY_FETCH, type ProxyFetchMessage, type ProxyFetchResponse } from "./messages";

export class UnauthenticatedError extends Error {}
export class QuotaExceededError extends Error {}

interface ProxiedResponse {
  status: number;
  ok: boolean;
  json: () => unknown;
}

// Content scripts can never bypass CORS (confirmed against Chrome's own docs, the hard
// way, after host_permissions alone didn't fix it), so every call is relayed through the
// background script, which can. Mirrors the shape of the global `fetch` we used to call
// directly, so the status-code handling in each function below didn't need to change.
async function backgroundFetch(
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string },
): Promise<ProxiedResponse> {
  const message: ProxyFetchMessage = { type: PROXY_FETCH, url, method: init.method, headers: init.headers, body: init.body };
  const response = (await chrome.runtime.sendMessage(message)) as ProxyFetchResponse;

  if (!response.ok) {
    throw new Error(`No se pudo contactar con el servidor: ${response.error}`);
  }

  return {
    status: response.status,
    ok: response.status >= 200 && response.status < 300,
    json: () => JSON.parse(response.bodyText),
  };
}

export async function loginWithGoogle(accessToken: string): Promise<string> {
  const res = await backgroundFetch(`${SERVER_BASE_URL}/api/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken }),
  });

  if (!res.ok) throw new UnauthenticatedError("No se pudo iniciar sesión.");

  const { sessionToken } = res.json() as { sessionToken: string };
  return sessionToken;
}

export async function classifyComments(sessionToken: string, request: ClassifyRequest): Promise<ClassifyResponse> {
  const res = await backgroundFetch(`${SERVER_BASE_URL}/api/classify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify(request),
  });

  if (res.status === 401) throw new UnauthenticatedError("La sesión ha caducado.");
  if (res.status === 402) throw new QuotaExceededError("Se ha agotado la cuota mensual.");
  if (!res.ok) throw new Error(`El servidor respondió con el estado ${res.status}.`);

  return res.json() as ClassifyResponse;
}

export async function recordCorrection(sessionToken: string, correction: CorrectionRequest): Promise<void> {
  const res = await backgroundFetch(`${SERVER_BASE_URL}/api/corrections`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify(correction),
  });

  if (res.status === 401) throw new UnauthenticatedError("La sesión ha caducado.");
  if (!res.ok) throw new Error(`El servidor respondió con el estado ${res.status}.`);
}
