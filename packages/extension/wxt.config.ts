import { fileURLToPath } from "node:url";
import preact from "@preact/preset-vite";
import { loadEnv } from "vite";
import { defineConfig } from "wxt";

// wxt.config.ts runs in Node before Vite's own client-side env handling kicks in, so the
// manifest fields below (key, oauth2.client_id) need their own explicit .env read rather
// than relying on import.meta.env. "" as the prefix means "no VITE_/WXT_ prefix required" —
// see packages/extension/.env.example for the two variables this reads.
const envDir = fileURLToPath(new URL(".", import.meta.url));
const env = loadEnv(process.env["NODE_ENV"] ?? "development", envDir, "");

// See packages/extension/src/auth/google-login.ts for why the extension's id must be
// stable: chrome.identity.getAuthToken() only works with a Google Cloud OAuth client
// registered against this exact id, and the id is derived from this public key.
const extensionPublicKey = env["EXTENSION_PUBLIC_KEY"];
const googleOAuthClientId = env["GOOGLE_OAUTH_CLIENT_ID"] || "REPLACE_WITH_REAL_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com";

// Must match packages/extension/src/server/config.ts's SERVER_BASE_URL (same env var).
// A content script's fetch() calls are subject to the target's CORS policy UNLESS the
// extension holds a host_permissions entry for it — without this, every call to our own
// server gets blocked by the browser before the server even sees the request, regardless
// of anything the server itself does. The production server's real domain is still an
// open deployment question (docs/ESPECIFICACION.md), so this stays overridable.
const serverOrigin = new URL(env["WXT_SERVER_BASE_URL"] || "http://localhost:3000").origin;

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: "src",
  vite: () => ({
    plugins: [preact()],
  }),
  manifest: {
    name: "CommentGuard",
    description: "Clasifica los comentarios de YouTube para proteger tu salud mental.",
    permissions: ["identity", "storage"],
    host_permissions: ["https://www.youtube.com/*", `${serverOrigin}/*`],
    ...(extensionPublicKey ? { key: extensionPublicKey } : {}),
    oauth2: {
      client_id: googleOAuthClientId,
      scopes: ["openid", "email"],
    },
  },
});
