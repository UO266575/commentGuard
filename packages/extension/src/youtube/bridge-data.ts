// Pulled out of `window.ytcfg` / `window.ytInitialData` by the MAIN-world page bridge
// (see page-bridge.ts) and handed to the isolated content script via a DOM CustomEvent.
export interface BridgeData {
  apiKey: string;
  context: unknown;
  initialContinuation: string | null;
}

interface SortMenuItem {
  selected?: boolean;
  serviceEndpoint?: {
    continuationCommand?: {
      token?: string;
    };
  };
}

// Recursively looks for `key` anywhere in `value`, the same resilience trick real-world
// YouTube scrapers use: YouTube nests this data differently depending on page layout and
// experiment bucket, but the key names themselves stay stable far longer than the paths do.
function findFirst<T>(value: unknown, key: string): T | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirst<T>(item, key);
      if (found !== undefined) return found;
    }
    return undefined;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (key in record) return record[key] as T;

    for (const nested of Object.values(record)) {
      const found = findFirst<T>(nested, key);
      if (found !== undefined) return found;
    }
  }

  return undefined;
}

// The comments panel's sort menu ("Top" / "Newest") carries the continuation token that
// kicks off the very first batch of top-level comments.
export function findInitialCommentsContinuation(ytInitialData: unknown): string | null {
  const menu = findFirst<{ subMenuItems?: SortMenuItem[] }>(ytInitialData, "sortFilterSubMenuRenderer");
  const items = menu?.subMenuItems ?? [];
  const selected = items.find((item) => item.selected) ?? items[0];

  return selected?.serviceEndpoint?.continuationCommand?.token ?? null;
}
