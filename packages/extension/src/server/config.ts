// Points at the local dev server by default. The real production URL is still an open
// deployment question; override it at build time with WXT_SERVER_BASE_URL.
export const SERVER_BASE_URL = import.meta.env["WXT_SERVER_BASE_URL"] ?? "http://localhost:3000";
