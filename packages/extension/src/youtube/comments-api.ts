import type { RawComment } from "@comment-classificator/shared";

// YouTube's unofficial, internal "next" endpoint. Not part of the public Data API, so it
// can change shape without notice — see docs/ESPECIFICACION.md, section "Obtención de
// comentarios". Keep all the parsing logic in this file so a breakage is easy to find.
const COMMENTS_ENDPOINT_PATH = "/youtubei/v1/next";

export interface TopLevelComment extends RawComment {
  // Display-only fields, never sent to the server (RawComment — just {id, text} — is what
  // actually goes into the classify request body).
  author: string;
  authorAvatarUrl: string;
  publishedTime: string;
  // Raw as YouTube formats it ("985", "4.8M"...), for display only.
  replyCount: string;
  repliesContinuation: string | null;
}

export interface CommentsPage {
  comments: TopLevelComment[];
  nextContinuation: string | null;
}

export interface Reply extends RawComment {
  author: string;
  authorAvatarUrl: string;
  publishedTime: string;
}

export interface RepliesPage {
  replies: Reply[];
  nextContinuation: string | null;
}

interface CommentEntityPayload {
  properties?: {
    commentId?: string;
    content?: { content?: string };
    replyLevel?: number;
    publishedTime?: string;
  };
  author?: {
    displayName?: string;
    avatarThumbnailUrl?: string;
  };
  toolbar?: {
    replyCount?: string;
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

interface ContinuationEndpoint {
  continuationCommand?: { token?: string };
}

interface CommentThreadItem {
  commentThreadRenderer?: {
    commentViewModel?: { commentViewModel?: { commentId?: string } };
    replies?: {
      commentRepliesRenderer?: {
        subThreads?: Array<{ continuationItemRenderer?: { continuationEndpoint?: ContinuationEndpoint } }>;
      };
    };
  };
  continuationItemRenderer?: { continuationEndpoint?: ContinuationEndpoint };
}

// Finds the one flat array of per-comment (or per-reply) thread items for this page
// (verified against a live watch page on 2026-10-14): a list of content entries followed
// by, at most, one continuationItemRenderer for the next page. The first load of
// top-level comments carries an extra, earlier action with only the comments-count
// header — real content is always in the LAST action, for both top-level and replies
// responses, so that's what this takes instead of pattern-matching the item shape (which
// differs between the two: commentThreadRenderer for top-level, something else for
// replies). Deliberately not a blind recursive search either way — a
// commentThreadRenderer's own reply continuation lives at the same key name nested one
// level down, inside its own "replies" thread, and must not be confused with this
// page-level "next batch" continuation.
function findThreadItems(response: unknown): CommentThreadItem[] {
  const endpoints = findAll<Record<string, unknown>>(response, "onResponseReceivedEndpoints").flat();
  const lastEndpoint = endpoints[endpoints.length - 1];

  const action = (lastEndpoint?.["reloadContinuationItemsCommand"] ?? lastEndpoint?.["appendContinuationItemsAction"]) as
    | { continuationItems?: CommentThreadItem[] }
    | undefined;

  return action?.continuationItems ?? [];
}

function findNextPageContinuation(items: CommentThreadItem[]): string | null {
  const paginationItem = items.find((item) => item.continuationItemRenderer);
  return paginationItem?.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token ?? null;
}

export function parseCommentsResponse(response: unknown): CommentsPage {
  const items = findThreadItems(response);

  const repliesContinuationById = new Map<string, string | null>();
  for (const item of items) {
    const thread = item.commentThreadRenderer;
    const commentId = thread?.commentViewModel?.commentViewModel?.commentId;
    if (!commentId) continue;

    const token =
      thread?.replies?.commentRepliesRenderer?.subThreads?.[0]?.continuationItemRenderer?.continuationEndpoint
        ?.continuationCommand?.token ?? null;
    repliesContinuationById.set(commentId, token);
  }

  const payloads = findAll<CommentEntityPayload>(response, "commentEntityPayload");
  const comments: TopLevelComment[] = payloads
    .filter((payload) => payload.properties?.replyLevel === 0)
    .map((payload) => {
      const id = payload.properties?.commentId ?? "";
      return {
        id,
        text: payload.properties?.content?.content ?? "",
        author: payload.author?.displayName ?? "",
        authorAvatarUrl: payload.author?.avatarThumbnailUrl ?? "",
        publishedTime: payload.properties?.publishedTime ?? "",
        replyCount: payload.toolbar?.replyCount ?? "0",
        repliesContinuation: repliesContinuationById.get(id) ?? null,
      };
    })
    .filter((comment) => comment.id !== "");

  return { comments, nextContinuation: findNextPageContinuation(items) };
}

// Replies are only fetched when the user expands a comment, and never classified — see
// docs/ESPECIFICACION.md, "Respuestas: solo se clasifica el comentario principal".
export function parseRepliesResponse(response: unknown): RepliesPage {
  const payloads = findAll<CommentEntityPayload>(response, "commentEntityPayload");
  const replies: Reply[] = payloads
    .filter((payload) => (payload.properties?.replyLevel ?? 0) > 0)
    .map((payload) => ({
      id: payload.properties?.commentId ?? "",
      text: payload.properties?.content?.content ?? "",
      author: payload.author?.displayName ?? "",
      authorAvatarUrl: payload.author?.avatarThumbnailUrl ?? "",
      publishedTime: payload.properties?.publishedTime ?? "",
    }))
    .filter((reply) => reply.id !== "");

  return { replies, nextContinuation: findNextPageContinuation(findThreadItems(response)) };
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

export async function fetchReplies(
  continuation: string,
  apiKey: string,
  context: unknown,
  fetchImpl: typeof fetch = fetch,
): Promise<RepliesPage> {
  const response = await fetchCommentsPage({ continuation, apiKey, context, fetchImpl });
  return parseRepliesResponse(response);
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
// "Límite inicial: los 300 comentarios principales más relevantes por vídeo". Returns the
// leftover continuation token (or null if YouTube truly ran out) so a "Cargar más" button
// can resume from exactly where this call stopped.
export async function* fetchTopLevelComments({
  apiKey,
  context,
  initialContinuation,
  maxComments = 300,
  fetchImpl = fetch,
}: FetchTopLevelCommentsOptions): AsyncGenerator<TopLevelComment[], string | null> {
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

  return continuation;
}
