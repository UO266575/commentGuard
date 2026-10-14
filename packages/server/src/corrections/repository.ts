import type { CorrectionRequest } from "@comment-classificator/shared";
import type { Database } from "../db/client.js";
import { commentCorrections } from "../db/schema.js";

export async function recordCorrection(db: Database, correction: CorrectionRequest): Promise<void> {
  await db.insert(commentCorrections).values(correction);
}
