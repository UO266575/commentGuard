import type { RawComment, Tab } from "@comment-classificator/shared";
import { requestGoogleAccessToken } from "../auth/google-login";
import { getStoredSessionToken, setStoredSessionToken } from "../auth/session-storage";
import { classifyComments, loginWithGoogle, UnauthenticatedError } from "../server/client";
import { waitForBridgeData } from "../youtube/bridge-listener";
import { fetchTopLevelComments } from "../youtube/comments-api";

export interface ClassifiedComment {
  id: string;
  text: string;
  category: Tab;
  confidence: number;
}

export async function ensureSessionToken(interactive: boolean): Promise<string> {
  const stored = await getStoredSessionToken();
  if (stored) return stored;

  const accessToken = await requestGoogleAccessToken(interactive);
  const sessionToken = await loginWithGoogle(accessToken);
  await setStoredSessionToken(sessionToken);
  return sessionToken;
}

function mergeTextIntoResults(batch: RawComment[], results: Array<{ commentId: string; category: Tab; confidence: number }>) {
  const textById = new Map(batch.map((comment) => [comment.id, comment.text]));
  return results.map((result) => ({
    id: result.commentId,
    text: textById.get(result.commentId) ?? "",
    category: result.category,
    confidence: result.confidence,
  }));
}

// Fetches raw comments from YouTube, then sends each batch of ~20 to the server for
// classification, yielding classified batches as they come back so the UI can fill tabs
// incrementally instead of waiting for all 300 comments at once.
export async function* classifyVideoComments(videoId: string, videoTitle: string): AsyncGenerator<ClassifiedComment[]> {
  let sessionToken = await ensureSessionToken(true);

  const bridgeData = await waitForBridgeData();
  if (!bridgeData.initialContinuation) {
    throw new Error("No se encontró la sección de comentarios de este vídeo.");
  }

  for await (const batch of fetchTopLevelComments({
    apiKey: bridgeData.apiKey,
    context: bridgeData.context,
    initialContinuation: bridgeData.initialContinuation,
  })) {
    let response;
    try {
      response = await classifyComments(sessionToken, { videoId, videoTitle, comments: batch });
    } catch (error) {
      if (!(error instanceof UnauthenticatedError)) throw error;
      // The stored session expired; re-authenticate once and retry this batch.
      sessionToken = await ensureSessionToken(true);
      response = await classifyComments(sessionToken, { videoId, videoTitle, comments: batch });
    }

    yield mergeTextIntoResults(batch, response.results);
  }
}
