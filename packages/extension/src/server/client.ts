import type { ClassifyRequest, ClassifyResponse } from "@comment-classificator/shared";
import { SERVER_BASE_URL } from "./config";

export class UnauthenticatedError extends Error {}
export class QuotaExceededError extends Error {}

export async function loginWithGoogle(accessToken: string): Promise<string> {
  const res = await fetch(`${SERVER_BASE_URL}/api/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken }),
  });

  if (!res.ok) throw new UnauthenticatedError("No se pudo iniciar sesión.");

  const { sessionToken } = (await res.json()) as { sessionToken: string };
  return sessionToken;
}

export async function classifyComments(sessionToken: string, request: ClassifyRequest): Promise<ClassifyResponse> {
  const res = await fetch(`${SERVER_BASE_URL}/api/classify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify(request),
  });

  if (res.status === 401) throw new UnauthenticatedError("La sesión ha caducado.");
  if (res.status === 402) throw new QuotaExceededError("Se ha agotado la cuota mensual.");
  if (!res.ok) throw new Error(`El servidor respondió con el estado ${res.status}.`);

  return (await res.json()) as ClassifyResponse;
}
