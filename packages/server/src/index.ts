import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { createGoogleTokenVerifier } from "./auth/google.js";
import { createDatabase } from "./db/client.js";
import { getDatabaseUrl, getJevApiKey, getJevMockMode, getMonthlyCommentQuota, getPort } from "./env.js";
import { createJevClient } from "./jev/client.js";
import { createMockJevClient } from "./jev/mock-client.js";

const { db } = createDatabase(getDatabaseUrl());

if (getJevMockMode()) {
  console.warn("JEV_MOCK_MODE está activo: las clasificaciones son categorías aleatorias, no de Jev de verdad.");
}

const app = createApp({
  db,
  googleVerifier: createGoogleTokenVerifier(),
  jevClient: getJevMockMode() ? createMockJevClient() : createJevClient(getJevApiKey()),
  monthlyQuota: getMonthlyCommentQuota(),
});

serve({ fetch: app.fetch, port: getPort() }, (info) => {
  console.log(`Server listening on http://localhost:${info.port}`);
});
