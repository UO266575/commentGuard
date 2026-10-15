import { CATEGORIES } from "@comment-classificator/shared";
import type { JevClassification, JevClient } from "./client.js";

// For local development/demos only, before a real JEV_API_KEY is available — assigns a
// random category and confidence instead of calling the real API, so the extension's
// tabs can be tried out with populated data. Enabled via JEV_MOCK_MODE — see env.ts. The
// real fallback behavior for an actual Jev failure (sin_clasificar, per
// docs/ESPECIFICACION.md) is untouched; this is a separate, explicitly opt-in path.
export function createMockJevClient(): JevClient {
  return {
    async classify(): Promise<JevClassification> {
      const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)] ?? "positivo";
      return { category, confidence: Math.random() };
    },
  };
}
