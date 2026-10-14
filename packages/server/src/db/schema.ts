import { integer, pgEnum, pgTable, primaryKey, real, serial, text, timestamp } from "drizzle-orm/pg-core";
import { CATEGORIES, UNCLASSIFIED } from "@comment-classificator/shared";

// Mirrors the fixed category list in packages/shared; see docs/ESPECIFICACION.md,
// "No se pueden añadir ni editar categorías en esta versión".
export const TAB_VALUES = [...CATEGORIES, UNCLASSIFIED] as const;
export const tabEnum = pgEnum("tab", [...TAB_VALUES]);

export const users = pgTable("users", {
  // The Google account's stable subject identifier doubles as our primary key, since
  // login is Google-only in this version (docs/ESPECIFICACION.md, "Cuentas").
  googleSub: text("google_sub").primaryKey(),
  email: text("email").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// One row per user per calendar month, so the monthly quota resets just by starting a new
// row — see docs/ESPECIFICACION.md, "cuota mensual de comentarios clasificados".
export const quotaUsage = pgTable(
  "quota_usage",
  {
    userGoogleSub: text("user_google_sub")
      .notNull()
      .references(() => users.googleSub),
    // 'YYYY-MM', e.g. "2026-10".
    periodMonth: text("period_month").notNull(),
    classifiedCount: integer("classified_count").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.userGoogleSub, table.periodMonth] })],
);

// Caches a classification by comment id so the same comment is never sent to Jev twice
// across different users watching the same video — see docs/ESPECIFICACION.md,
// "Caché por comentario". Entries older than 60 days are treated as a cache miss; see
// isCacheEntryFresh in cache/repository.ts.
export const commentClassificationCache = pgTable("comment_classification_cache", {
  commentId: text("comment_id").primaryKey(),
  category: tabEnum("category").notNull(),
  confidence: real("confidence").notNull(),
  modelVersion: text("model_version").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// A comment can be corrected more than once over time (e.g. by different viewers), so
// each correction is its own row rather than overwriting the cache — see
// docs/ESPECIFICACION.md, "Correcciones". Deliberately does NOT overwrite
// comment_classification_cache: letting one viewer's correction silently change what
// every other viewer of the same video sees isn't something the spec asks for.
export const commentCorrections = pgTable("comment_corrections", {
  id: serial("id").primaryKey(),
  commentId: text("comment_id").notNull(),
  originalCategory: tabEnum("original_category").notNull(),
  correctedCategory: tabEnum("corrected_category").notNull(),
  modelVersion: text("model_version").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
