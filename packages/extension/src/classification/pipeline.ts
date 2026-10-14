import { JEV_MODEL_VERSION, type CorrectionRequest, type RawComment, type Tab } from "@comment-classificator/shared";
import { requestGoogleAccessToken } from "../auth/google-login";
import { getStoredSessionToken, setStoredSessionToken } from "../auth/session-storage";
import { classifyComments, loginWithGoogle, recordCorrection, UnauthenticatedError } from "../server/client";
import { waitForBridgeData } from "../youtube/bridge-listener";
import { fetchReplies as fetchRepliesPage, fetchTopLevelComments, type TopLevelComment } from "../youtube/comments-api";

export interface ClassifiedComment {
  id: string;
  text: string;
  category: Tab;
  confidence: number;
  replyCount: string;
  repliesContinuation: string | null;
}

export async function ensureSessionToken(interactive: boolean): Promise<string> {
  const stored = await getStoredSessionToken();
  if (stored) return stored;

  const accessToken = await requestGoogleAccessToken(interactive);
  const sessionToken = await loginWithGoogle(accessToken);
  await setStoredSessionToken(sessionToken);
  return sessionToken;
}

// Runs an authenticated server call once, and if the stored session has expired, logs in
// again (interactively, since re-authenticating silently isn't possible with
// chrome.identity) and retries exactly once.
async function withSession<T>(run: (sessionToken: string) => Promise<T>): Promise<T> {
  const sessionToken = await ensureSessionToken(true);
  try {
    return await run(sessionToken);
  } catch (error) {
    if (!(error instanceof UnauthenticatedError)) throw error;
    const freshToken = await ensureSessionToken(true);
    return run(freshToken);
  }
}

function mergeTextIntoResults(
  batch: TopLevelComment[],
  results: Array<{ commentId: string; category: Tab; confidence: number }>,
): ClassifiedComment[] {
  const byId = new Map(batch.map((comment) => [comment.id, comment]));

  return results.map((result) => {
    const source = byId.get(result.commentId);
    return {
      id: result.commentId,
      text: source?.text ?? "",
      category: result.category,
      confidence: result.confidence,
      replyCount: source?.replyCount ?? "0",
      repliesContinuation: source?.repliesContinuation ?? null,
    };
  });
}

// Fetches raw comments from YouTube, then sends each batch of ~20 to the server for
// classification, yielding classified batches as they come back so the UI can fill tabs
// incrementally instead of waiting for all 300 comments at once. Returns the leftover
// YouTube continuation token (or null if YouTube ran out), so a "Cargar más" button can
// resume from exactly where this call stopped — see docs/ESPECIFICACION.md, "Límite
// inicial: ... con un botón de Cargar más".
export async function* classifyVideoComments(
  videoId: string,
  videoTitle: string,
  startContinuation?: string,
): AsyncGenerator<ClassifiedComment[], string | null> {
  const bridgeData = await waitForBridgeData();
  const continuation = startContinuation ?? bridgeData.initialContinuation;
  if (!continuation) {
    throw new Error("No se encontró la sección de comentarios de este vídeo.");
  }

  const commentsIterator = fetchTopLevelComments({
    apiKey: bridgeData.apiKey,
    context: bridgeData.context,
    initialContinuation: continuation,
  });

  let result = await commentsIterator.next();
  while (!result.done) {
    const batch = result.value;
    const response = await withSession((sessionToken) => classifyComments(sessionToken, { videoId, videoTitle, comments: batch }));
    yield mergeTextIntoResults(batch, response.results);
    result = await commentsIterator.next();
  }

  return result.value;
}

// Replies are fetched only when the user expands a comment, and never classified — see
// docs/ESPECIFICACION.md, "Respuestas: solo se clasifica el comentario principal".
export async function fetchCommentReplies(continuation: string): Promise<{ replies: RawComment[]; nextContinuation: string | null }> {
  const bridgeData = await waitForBridgeData();
  return fetchRepliesPage(continuation, bridgeData.apiKey, bridgeData.context);
}

export async function submitCorrection(correction: Omit<CorrectionRequest, "modelVersion">): Promise<void> {
  await withSession((sessionToken) => recordCorrection(sessionToken, { ...correction, modelVersion: JEV_MODEL_VERSION }));
}
