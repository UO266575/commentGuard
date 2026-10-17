import { isTab, JEV_MODEL_VERSION, UNCLASSIFIED, type Category, type Tab } from "@comment-classificator/shared";

// See docs/ESPECIFICACION.md, "Clasificación con Jev". The exact auth header isn't shown
// in the spec's example request, only the body shape — Bearer-in-Authorization is the
// conventional default and should be confirmed against the real docs once JEV_API_KEY is
// available.
const JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const RETRYABLE_STATUSES = new Set([429, 529]);
const MAX_ATTEMPTS = 4;

// Bumped whenever CATEGORY_CRITERIA or the instructions below change meaning, so cached
// classifications made under an older wording don't linger for up to 60 days looking like
// they were judged by criteria that no longer apply — see cache/repository.ts, which
// treats a cache entry's model_version as a cache miss if it doesn't match
// JEV_FULL_MODEL_VERSION below.
export const CRITERIA_VERSION = 2;
export const JEV_FULL_MODEL_VERSION = `${JEV_MODEL_VERSION}+c${CRITERIA_VERSION}`;

const CLASSIFICATION_INSTRUCTIONS =
  "Classify this YouTube comment, written to the video's creator, into the single best category. Comments can be in any language, often Spanish from Spain, and use slang, irony and colloquial expressions. Judge the intended meaning, not the literal words: \"pedazo serie\", \"brutal\", \"tremendo vídeo\", \"qué crack\" or \"me flipa\" are praise; \"vaya truño\" or \"menuda basura\" are negative.";

const CATEGORY_CRITERIA: Record<Category, string> = {
  positivo: "Praise, thanks or support for the creator or the video.",
  constructivo:
    "A genuine question, request or suggestion addressed to the creator about the content, or criticism that explains how to improve it. Rhetorical questions, jokes and memes such as 'who's watching in 2026?' do not count.",
  neutral: "Talks about the topic, shares an anecdote, makes a joke or a meme, or reacts without giving an opinion about the creator or the video.",
  spam: "Scams, money offers, links, self-promotion, or text that looks automated.",
  negativo: "A negative or dismissive opinion about the creator or the video, without insults and without explaining how to improve.",
  toxico: "Insults, harassment, discrimination, threats or hateful attacks.",
};

export interface JevInput {
  videoTitle: string;
  comment: string;
}

export interface JevClassification {
  category: Tab;
  confidence: number;
}

export interface JevClient {
  classify(input: JevInput): Promise<JevClassification>;
}

interface JevResponseBody {
  answers: {
    category: {
      choice: string;
      confidence: number;
    };
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface CreateJevClientOptions {
  fetchImpl?: typeof fetch;
  // Exposed so tests don't have to wait out real exponential backoff delays.
  retryBaseDelayMs?: number;
}

export function createJevClient(apiKey: string, options: CreateJevClientOptions = {}): JevClient {
  const { fetchImpl = fetch, retryBaseDelayMs = 500 } = options;

  return {
    async classify({ videoTitle, comment }: JevInput): Promise<JevClassification> {
      let lastError: unknown;

      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
        if (attempt > 0) await sleep(2 ** (attempt - 1) * retryBaseDelayMs);

        let response: Response;
        try {
          response = await fetchImpl(JEV_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
              model: JEV_MODEL_VERSION,
              state: { platform: "YouTube", video_title: videoTitle, comment },
              questions: {
                category: {
                  type: "choice",
                  instructions: CLASSIFICATION_INSTRUCTIONS,
                  criteria: CATEGORY_CRITERIA,
                },
              },
            }),
          });
        } catch (error) {
          lastError = error;
          continue;
        }

        if (response.ok) {
          const body = (await response.json()) as JevResponseBody;
          const { choice, confidence } = body.answers.category;
          return { category: isTab(choice) ? choice : UNCLASSIFIED, confidence };
        }

        lastError = new Error(`Jev respondió con el estado ${response.status}`);
        if (!RETRYABLE_STATUSES.has(response.status)) break;
      }

      throw lastError instanceof Error ? lastError : new Error("No se pudo clasificar el comentario con Jev.");
    },
  };
}
