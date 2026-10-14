import type { RawComment } from "@comment-classificator/shared";

// YouTube's unofficial, internal "next" endpoint. Not part of the public Data API, so it
// can change shape without notice — see docs/ESPECIFICACION.md, section "Obtención de
// comentarios". Keep all the parsing logic in this file so a breakage is easy to find.
const COMMENTS_ENDPOINT_PATH = "/youtubei/v1/next";

export interface CommentsPage {
  comments: RawComment[];
  nextContinuation: string | null;
}

interface CommentEntityPayload {
  properties?: {
    commentId?: string;
    content?: { content?: string };
    replyLevel?: number;
  };
}

// Same resilience trick as bridge-data.ts: search by key name instead of hard-coding the
// full path, since YouTube reshuffles the surrounding wrapper objects more often than it
// renames the leaf keys.
function findAll<T>(value: unknown, key: string, results: T[] = []): T[] {
  if (Array.isArray(value)) {
    for (const item of value) findAll(item, key, results);
    return results;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (key in record) results.push(record[key] as T);

    for (const nested of Object.values(record)) findAll(nested, key, results);
  }

  return results;
}

interface ContinuationAction {
  continuationItems?: Array<{
    continuationItemRenderer?: {
      continuationEndpoint?: { continuationCommand?: { token?: string } };
    };
  }>;
}

// Unlike the comment lookup, this one is deliberately NOT a blind recursive search: a
// `continuationItemRenderer` also shows up nested under each comment's own "replies"
// thread, and that reply continuation must not be mistaken for the next page of
// top-level comments. Only the action-level continuationItems array (the direct sibling
// list of commentThreadRenderer entries) holds the real pagination token.
function findNextPageContinuation(response: unknown): string | null {
  const endpoints = findAll<Record<string, unknown>>(response, "onResponseReceivedEndpoints").flat();

  for (const endpoint of endpoints) {
    const action = (endpoint.reloadContinuationItemsCommand ??
      endpoint.appendContinuationItemsAction) as ContinuationAction | undefined;

    const paginationItem = action?.continuationItems?.find((item) => item.continuationItemRenderer);
    const token = paginationItem?.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
    if (token) return token;
  }

  return null;
}

export function parseCommentsResponse(response: unknown): CommentsPage {
  const payloads = findAll<CommentEntityPayload>(response, "commentEntityPayload");

  const comments: RawComment[] = payloads
    .filter((payload) => payload.properties?.replyLevel === 0)
    .map((payload) => ({
      id: payload.properties?.commentId ?? "",
      text: payload.properties?.content?.content ?? "",
    }))
    .filter((comment) => comment.id !== "");

  return { comments, nextContinuation: findNextPageContinuation(response) };
}

export interface FetchCommentsPageOptions {
  continuation: string;
  apiKey: string;
  context: unknown;
  fetchImpl?: typeof fetch;
}

export async function fetchCommentsPage({
  continuation,
  apiKey,
  context,
  fetchImpl = fetch,
}: FetchCommentsPageOptions): Promise<unknown> {
  const url = `https://www.youtube.com${COMMENTS_ENDPOINT_PATH}?key=${encodeURIComponent(apiKey)}`;

  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ context, continuation }),
  });

  if (!response.ok) {
    throw new Error(`YouTube comments request failed with status ${response.status}`);
  }

  return response.json();
}

export interface FetchTopLevelCommentsOptions {
  apiKey: string;
  context: unknown;
  initialContinuation: string;
  maxComments?: number;
  fetchImpl?: typeof fetch;
}

// Yields comments in the ~20-per-call batches YouTube returns them in, stopping once
// `maxComments` is reached or YouTube runs out of pages — see docs/ESPECIFICACION.md,
// "Límite inicial: los 300 comentarios principales más relevantes por vídeo".
export async function* fetchTopLevelComments({
  apiKey,
  context,
  initialContinuation,
  maxComments = 300,
  fetchImpl = fetch,
}: FetchTopLevelCommentsOptions): AsyncGenerator<RawComment[]> {
  let continuation: string | null = initialContinuation;
  let fetched = 0;

  while (continuation && fetched < maxComments) {
    const response = await fetchCommentsPage({ continuation, apiKey, context, fetchImpl });
    const page = parseCommentsResponse(response);

    const remaining = maxComments - fetched;
    const batch = page.comments.slice(0, remaining);
    if (batch.length > 0) {
      yield batch;
      fetched += batch.length;
    }

    continuation = page.nextContinuation;
  }
}
