import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { CONFIDENCE_THRESHOLD, JEV_MODEL_VERSION, UNCLASSIFIED, type ClassifyResponse } from "@comment-classificator/shared";
import type { AppEnv } from "./app-env.js";
import type { GoogleTokenVerifier } from "./auth/google.js";
import { requireSession } from "./auth/middleware.js";
import { createSessionToken } from "./auth/session.js";
import { getCachedClassifications, storeClassifications, type CachedClassification } from "./cache/repository.js";
import type { Database } from "./db/client.js";
import type { JevClient } from "./jev/client.js";
import { consumeQuota, getRemainingQuota } from "./quota/repository.js";
import { findOrCreateUser } from "./users/repository.js";

export interface AppDependencies {
  db: Database;
  googleVerifier: GoogleTokenVerifier;
  jevClient: JevClient;
  monthlyQuota: number;
}

const classifyRequestSchema = z.object({
  videoId: z.string().min(1),
  videoTitle: z.string(),
  comments: z.array(z.object({ id: z.string().min(1), text: z.string() })),
});

export function createApp(deps: AppDependencies) {
  const app = new Hono<AppEnv>();

  app.get("/health", (c) => c.json({ status: "ok" }));

  app.post("/api/auth/google", zValidator("json", z.object({ accessToken: z.string().min(1) })), async (c) => {
    const { accessToken } = c.req.valid("json");

    let identity;
    try {
      identity = await deps.googleVerifier.verify(accessToken);
    } catch {
      return c.json({ error: "No se pudo verificar la sesión de Google." }, 401);
    }

    const user = await findOrCreateUser(deps.db, identity);
    const sessionToken = await createSessionToken(user.googleSub);
    return c.json({ sessionToken });
  });

  app.post("/api/classify", requireSession, zValidator("json", classifyRequestSchema), async (c) => {
    const userGoogleSub = c.get("userGoogleSub");
    const { videoTitle, comments } = c.req.valid("json");

    const cached = await getCachedClassifications(
      deps.db,
      comments.map((comment) => comment.id),
    );
    const uncached = comments.filter((comment) => !cached.has(comment.id));

    // Provisional: only cache misses count against quota, since whether a cache hit
    // should too is still an open question — see docs/ESPECIFICACION.md, "Modelo de
    // negocio y puntos abiertos".
    const remaining = await getRemainingQuota(deps.db, userGoogleSub, deps.monthlyQuota);
    if (uncached.length > remaining) {
      return c.json({ error: "Cuota mensual agotada." }, 402);
    }

    if (uncached.length > 0) {
      const newEntries: CachedClassification[] = await Promise.all(
        uncached.map(async (comment) => {
          try {
            const { category, confidence } = await deps.jevClient.classify({ videoTitle, comment: comment.text });
            // See docs/ESPECIFICACION.md: below the confidence threshold, treat as unclassified.
            return {
              commentId: comment.id,
              category: confidence >= CONFIDENCE_THRESHOLD ? category : UNCLASSIFIED,
              confidence,
              modelVersion: JEV_MODEL_VERSION,
            };
          } catch {
            // A comment that Jev couldn't classify (after retries) also goes to "Sin clasificar".
            return { commentId: comment.id, category: UNCLASSIFIED, confidence: 0, modelVersion: JEV_MODEL_VERSION };
          }
        }),
      );

      await storeClassifications(deps.db, newEntries);
      await consumeQuota(deps.db, userGoogleSub, uncached.length);
      for (const entry of newEntries) cached.set(entry.commentId, entry);
    }

    const response: ClassifyResponse = {
      results: comments.map((comment) => {
        const hit = cached.get(comment.id);
        return {
          commentId: comment.id,
          category: hit?.category ?? UNCLASSIFIED,
          confidence: hit?.confidence ?? 0,
        };
      }),
    };

    return c.json(response);
  });

  return app;
}
