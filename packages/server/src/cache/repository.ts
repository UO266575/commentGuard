import { inArray, lt, sql } from "drizzle-orm";
import type { Tab } from "@comment-classificator/shared";
import type { Database } from "../db/client.js";
import { commentClassificationCache } from "../db/schema.js";

// See docs/ESPECIFICACION.md, "Caducidad: las entradas se borran a los 60 días".
const CACHE_TTL_DAYS = 60;
const CACHE_TTL_MS = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;

export interface CachedClassification {
  commentId: string;
  category: Tab;
  confidence: number;
  modelVersion: string;
}

function isFresh(createdAt: Date, now: Date): boolean {
  return now.getTime() - createdAt.getTime() < CACHE_TTL_MS;
}

// Entries older than the TTL, or classified under a different model_version, are treated
// as a cache miss rather than actively deleted/rewritten on every read;
// deleteExpiredCacheEntries does the TTL cleanup and is meant to run on a schedule (not
// wired up yet — see docs/ESPECIFICACION.md "Caducidad"). A version mismatch gets
// overwritten in place the next time that comment is classified, since storeClassifications
// upserts by commentId.
export async function getCachedClassifications(
  db: Database,
  commentIds: string[],
  expectedModelVersion: string,
  now = new Date(),
): Promise<Map<string, CachedClassification>> {
  if (commentIds.length === 0) return new Map();

  const rows = await db
    .select()
    .from(commentClassificationCache)
    .where(inArray(commentClassificationCache.commentId, commentIds));

  const result = new Map<string, CachedClassification>();
  for (const row of rows) {
    if (row.modelVersion === expectedModelVersion && isFresh(row.createdAt, now)) {
      result.set(row.commentId, {
        commentId: row.commentId,
        category: row.category,
        confidence: row.confidence,
        modelVersion: row.modelVersion,
      });
    }
  }

  return result;
}

export async function storeClassifications(db: Database, entries: CachedClassification[]): Promise<void> {
  if (entries.length === 0) return;

  await db
    .insert(commentClassificationCache)
    .values(entries.map((entry) => ({ ...entry, createdAt: new Date() })))
    .onConflictDoUpdate({
      target: commentClassificationCache.commentId,
      set: {
        category: sql`excluded.category`,
        confidence: sql`excluded.confidence`,
        modelVersion: sql`excluded.model_version`,
        createdAt: sql`excluded.created_at`,
      },
    });
}

export async function deleteExpiredCacheEntries(db: Database, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - CACHE_TTL_MS);

  const deleted = await db
    .delete(commentClassificationCache)
    .where(lt(commentClassificationCache.createdAt, cutoff))
    .returning({ commentId: commentClassificationCache.commentId });

  return deleted.length;
}
