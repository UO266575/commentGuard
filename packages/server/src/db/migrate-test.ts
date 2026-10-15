import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDatabase } from "./client.js";

// Separate entrypoint from migrate.ts on purpose: applies migrations to TEST_DATABASE_URL
// instead of DATABASE_URL — see test-db.ts for why those must stay two different databases.
const url = process.env["TEST_DATABASE_URL"];
if (!url) throw new Error("Falta la variable de entorno TEST_DATABASE_URL");

const { db, close } = createDatabase(url);
await migrate(db, { migrationsFolder: "./drizzle" });
await close();
console.log("Migraciones aplicadas a la base de datos de test.");
