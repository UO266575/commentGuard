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
    permissions: [],
    host_permissions: ["https://www.youtube.com/*"],
  },
});
