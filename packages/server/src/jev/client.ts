import { isTab, JEV_MODEL_VERSION, UNCLASSIFIED, type Category, type Tab } from "@comment-classificator/shared";

// See docs/ESPECIFICACION.md, "Clasificación con Jev". The exact auth header isn't shown
// in the spec's example request, only the body shape — Bearer-in-Authorization is the
// conventional default and should be confirmed against the real docs once JEV_API_KEY is
// available.
const JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const RETRYABLE_STATUSES = new Set([429, 529]);
const MAX_ATTEMPTS = 4;

const CATEGORY_CRITERIA: Record<Category, string> = {
  positivo: "Admiration, gratitude, or support for the video or its creator.",
  constructivo: "Questions, suggestions, or criticism meant to help the creator improve.",
  neutral: "Comments about the topic or something else, without expressing an opinion.",
  irrelevante: "Off-topic comments, bots, or spam.",
  negativo: "Negative or dismissive tone, without being toxic.",
  toxico: "Insults, harassment, discrimination, or threats.",
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
                  instructions:
                    "Classify this YouTube comment, written to the video's creator, into the single best category.",
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
