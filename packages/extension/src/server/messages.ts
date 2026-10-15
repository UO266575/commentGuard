// Content scripts run inside the web page's own security context and can NEVER bypass
// CORS, no matter what host_permissions the extension holds — only the background
// service worker, popup and options pages can. Confirmed against Chrome's own docs after
// host_permissions alone didn't fix a CORS error in testing. So every call to our server
// is relayed through the background script instead of fetched directly here.
export const PROXY_FETCH = "commentguard:proxy-fetch";

export interface ProxyFetchMessage {
  type: typeof PROXY_FETCH;
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

export type ProxyFetchResponse = { ok: true; status: number; bodyText: string } | { ok: false; error: string };
