// Reads env vars lazily, one getter per concern, so importing this module never fails —
// only the code path that actually needs a given variable does. Keeps unrelated unit
// tests (e.g. Google token parsing) from requiring the full .env to be set up.
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

export function getPort(): number {
  return Number(process.env["PORT"] ?? 3000);
}

export function getDatabaseUrl(): string {
  return required("DATABASE_URL");
}

export function getGoogleClientId(): string {
  return required("GOOGLE_CLIENT_ID");
}

export function getSessionSecret(): string {
  return required("SESSION_SECRET");
}

// Provisional default; the real plan size is still an open question — see
// docs/ESPECIFICACION.md, "Modelo de negocio y puntos abiertos".
export function getMonthlyCommentQuota(): number {
  return Number(process.env["MONTHLY_COMMENT_QUOTA"] ?? 1000);
}
