import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { createGoogleTokenVerifier } from "./auth/google.js";
import { createDatabase } from "./db/client.js";
import { getDatabaseUrl, getMonthlyCommentQuota, getPort } from "./env.js";

const { db } = createDatabase(getDatabaseUrl());

const app = createApp({
  db,
  googleVerifier: createGoogleTokenVerifier(),
  monthlyQuota: getMonthlyCommentQuota(),
});

serve({ fetch: app.fetch, port: getPort() }, (info) => {
  console.log(`Server listening on http://localhost:${info.port}`);
});
