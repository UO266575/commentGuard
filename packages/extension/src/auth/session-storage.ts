// chrome.storage.local, not localStorage: a content script's localStorage is YouTube's own
// page storage, not the extension's.
const SESSION_TOKEN_KEY = "commentguard:sessionToken";

export async function getStoredSessionToken(): Promise<string | null> {
  const stored = await chrome.storage.local.get(SESSION_TOKEN_KEY);
  return (stored[SESSION_TOKEN_KEY] as string | undefined) ?? null;
}

export async function setStoredSessionToken(token: string): Promise<void> {
  await chrome.storage.local.set({ [SESSION_TOKEN_KEY]: token });
}

export async function clearStoredSessionToken(): Promise<void> {
  await chrome.storage.local.remove(SESSION_TOKEN_KEY);
}
