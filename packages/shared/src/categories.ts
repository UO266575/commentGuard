// The six fixed categories Jev assigns to a top-level comment (see docs/ESPECIFICACION.md).
export const CATEGORIES = [
  "positivo",
  "constructivo",
  "neutral",
  "irrelevante",
  "negativo",
  "toxico",
] as const;

export type Category = (typeof CATEGORIES)[number];

// Comments below CONFIDENCE_THRESHOLD land here instead of a real category.
export const UNCLASSIFIED = "sin_clasificar";

export type Tab = Category | typeof UNCLASSIFIED;

export const CONFIDENCE_THRESHOLD = 0.5;

export const JEV_MODEL_VERSION = "jev-1.13.0";

interface TabDefinition {
  id: Tab;
  label: string;
}

// Display order for the comment tabs, as specified in docs/ESPECIFICACION.md.
export const TABS: readonly TabDefinition[] = [
  { id: "positivo", label: "Positivos" },
  { id: "constructivo", label: "Dudas, sugerencias y crítica constructiva" },
  { id: "neutral", label: "Neutrales" },
  { id: "irrelevante", label: "Irrelevantes" },
  { id: "negativo", label: "Negativos" },
  { id: "toxico", label: "Tóxicos" },
  { id: UNCLASSIFIED, label: "Sin clasificar" },
];

export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}

export function isTab(value: string): value is Tab {
  return value === UNCLASSIFIED || isCategory(value);
}
