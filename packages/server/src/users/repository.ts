import type { Database } from "../db/client.js";
import { users } from "../db/schema.js";

export interface GoogleProfile {
  googleSub: string;
  email: string;
}

// Upsert instead of select-then-insert: avoids a race between two concurrent logins for
// a brand-new user, and keeps the stored email in sync if the user changes it on Google.
export async function findOrCreateUser(db: Database, profile: GoogleProfile) {
  const [user] = await db
    .insert(users)
    .values(profile)
    .onConflictDoUpdate({ target: users.googleSub, set: { email: profile.email } })
    .returning();

  if (!user) throw new Error("No se pudo crear o actualizar el usuario");
  return user;
}
