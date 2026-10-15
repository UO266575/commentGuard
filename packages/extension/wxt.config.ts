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
    host_permissions: ["https://www.youtube.com/*"],
    ...(extensionPublicKey ? { key: extensionPublicKey } : {}),
    oauth2: {
      client_id: googleOAuthClientId,
      scopes: ["openid", "email"],
    },
  },
});
