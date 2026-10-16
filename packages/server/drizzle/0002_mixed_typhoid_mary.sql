-- drizzle-kit's naive diff would DROP and recreate the "tab" enum, casting every column
-- back through ::"tab" — which fails on any row still holding the literal 'irrelevante',
-- since the freshly recreated enum no longer has that value. RENAME VALUE instead keeps
-- the enum's identity (and every column using it) untouched; it only renames the label,
-- so cache/correction rows that were 'irrelevante' read as 'spam' automatically, with no
-- data loss and no risk of a failed cast.
ALTER TYPE "public"."tab" RENAME VALUE 'irrelevante' TO 'spam';
