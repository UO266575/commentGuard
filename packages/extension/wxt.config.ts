import preact from "@preact/preset-vite";
import { defineConfig } from "wxt";

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
    oauth2: {
      // Placeholder: real login only works once this is a client id registered in Google
      // Cloud Console for this extension's actual id — see packages/extension/src/auth/google-login.ts.
      client_id: process.env["GOOGLE_OAUTH_CLIENT_ID"] ?? "REPLACE_WITH_REAL_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com",
      scopes: ["openid", "email"],
    },
  },
});
