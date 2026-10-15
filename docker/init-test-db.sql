-- Runs once, only when the postgres container's data volume is first created. Gives
-- repository/integration tests (see packages/server/src/db/test-db.ts) a database
-- completely separate from the one `pnpm dev` uses, since those tests truncate every
-- table between cases.
CREATE DATABASE comment_classificator_test;
