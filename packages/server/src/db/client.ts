import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export type Database = ReturnType<typeof drizzle<typeof schema>>;

export interface DatabaseHandle {
  db: Database;
  close: () => Promise<void>;
}

export function createDatabase(connectionString: string): DatabaseHandle {
  const client = postgres(connectionString);
  return { db: drizzle(client, { schema }), close: () => client.end() };
}
