import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDatabase } from "./client.js";
import { getDatabaseUrl } from "../env.js";

const { db, close } = createDatabase(getDatabaseUrl());
await migrate(db, { migrationsFolder: "./drizzle" });
await close();
console.log("Migraciones aplicadas.");

