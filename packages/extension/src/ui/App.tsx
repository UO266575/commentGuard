import { useMemo, useState } from "preact/hooks";
import { TABS, type Tab } from "@comment-classificator/shared";
import type { ClassifiedComment } from "../classification/pipeline";
import type { Reply } from "../youtube/comments-api";

type ViewState =
  | { kind: "choice" }
  // Only shown before the very first batch arrives — once there's anything to show, the
  // rest loads in the background while the user reads (see ResultsView's isLoadingMore).
  | { kind: "loading" }
  | { kind: "results"; comments: ClassifiedComment[]; nextContinuation: string | null; isLoadingMore: boolean }
  | { kind: "error"; message: string };

export interface AppProps {
  onUnfiltered: () => void;
  // Returns an async generator rather than a promise so the UI can fill tabs as batches
  // of ~20 classified comments arrive, instead of waiting for all 300 at once. Pass a
  // continuation to resume a previous call instead of starting over (see "Cargar más").
  fetchClassifiedComments: (continuation?: string) => AsyncGenerator<ClassifiedComment[], string | null>;
  fetchReplies: (continuation: string) => Promise<{ replies: Reply[]; nextContinuation: string | null }>;
  submitCorrection: (correction: { commentId: string; originalCategory: Tab; correctedCategory: Tab }) => Promise<void>;
}

// Purely decorative — a quick visual anchor per category, not a substitute for the text
// label that's always shown right next to it.
const TAB_ICONS: Record<Tab, string> = {
  positivo: "👍",
  constructivo: "💡",
  neutral: "💬",
  irrelevante: "🚫",
  negativo: "👎",
  toxico: "⚠️",
  sin_clasificar: "❓",
};

function groupByTab(comments: ClassifiedComment[]): Map<Tab, ClassifiedComment[]> {
  const groups = new Map<Tab, ClassifiedComment[]>(TABS.map((tab) => [tab.id, []]));
  for (const comment of comments) groups.get(comment.category)?.push(comment);
  return groups;
}

function Spinner() {
  return <span class="cg-spinner" aria-hidden="true" />;
}

interface AvatarProps {
  src: string;
  name: string;
  size?: "normal" | "small";
}

function Avatar({ src, name, size = "normal" }: AvatarProps) {
  const sizeClass = size === "small" ? "cg-avatar cg-avatar--small" : "cg-avatar";

  if (src) {
    return <img class={sizeClass} src={src} alt="" loading="lazy" />;
  }

  // No avatar URL (shouldn't normally happen, but comment text might) — fall back to a
  // YouTube-style initial badge instead of a broken image icon.
  const initial = name.replace(/^@/, "").charAt(0).toUpperCase() || "?";
  return (
    <span class={`${sizeClass} cg-avatar-fallback`} aria-hidden="true">
      {initial}
    </span>
  );
}

interface CommentRowProps {
  comment: ClassifiedComment;
  onCorrected: (commentId: string, category: Tab) => void;
  fetchReplies: AppProps["fetchReplies"];
  submitCorrection: AppProps["submitCorrection"];
}

function CommentRow({ comment, onCorrected, fetchReplies, submitCorrection }: CommentRowProps) {
  const [replies, setReplies] = useState<Reply[] | null>(null);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [correctionError, setCorrectionError] = useState<string | null>(null);

  async function handleShowReplies() {
    if (replies !== null || loadingReplies || !comment.repliesContinuation) return;
    setLoadingReplies(true);
    try {
      const { replies: fetched } = await fetchReplies(comment.repliesContinuation);
      setReplies(fetched);
    } catch {
      setReplies([]);
    } finally {
      setLoadingReplies(false);
    }
  }

  async function handleCorrect(category: Tab) {
    setCorrecting(false);
    setCorrectionError(null);
    try {
      await submitCorrection({ commentId: comment.id, originalCategory: comment.category, correctedCategory: category });
      onCorrected(comment.id, category);
    } catch (error) {
      setCorrectionError(error instanceof Error ? error.message : "No se pudo guardar la corrección.");
    }
  }

  return (
    <li class="cg-comment">
      <Avatar src={comment.authorAvatarUrl} name={comment.author} />
      <div class="cg-comment-body">
        <div class="cg-comment-meta">
          {comment.author && <span class="cg-comment-author">{comment.author}</span>}
          {comment.publishedTime && <span class="cg-comment-time">{comment.publishedTime}</span>}
        </div>
        <p class="cg-comment-text">{comment.text}</p>

        <div class="cg-comment-actions">
          {comment.repliesContinuation && (
            <button type="button" class="cg-link-button" onClick={handleShowReplies} disabled={loadingReplies}>
              {replies !== null
                ? `${replies.length} respuesta${replies.length === 1 ? "" : "s"}`
                : loadingReplies
                  ? "Cargando…"
                  : `Ver respuestas (${comment.replyCount})`}
            </button>
          )}

          {correcting ? (
            <select
              class="cg-select"
              onBlur={() => setCorrecting(false)}
              onChange={(event) => handleCorrect((event.currentTarget as HTMLSelectElement).value as Tab)}
            >
              <option value="">Elige la categoría correcta…</option>
              {TABS.filter((tab) => tab.id !== comment.category).map((tab) => (
                <option key={tab.id} value={tab.id}>
                  {tab.label}
                </option>
              ))}
            </select>
          ) : (
            <button type="button" class="cg-link-button" onClick={() => setCorrecting(true)}>
              Mal clasificado
            </button>
          )}
        </div>

        {correctionError && <p class="cg-error">{correctionError}</p>}

        {replies !== null && replies.length > 0 && (
          <ul class="cg-reply-list">
            {replies.map((reply) => (
              <li key={reply.id} class="cg-reply">
                <Avatar src={reply.authorAvatarUrl} name={reply.author} size="small" />
                <div class="cg-comment-body">
                  <div class="cg-comment-meta">
                    {reply.author && <span class="cg-comment-author">{reply.author}</span>}
                    {reply.publishedTime && <span class="cg-comment-time">{reply.publishedTime}</span>}
                  </div>
                  <p class="cg-reply-text">{reply.text}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

interface ResultsViewProps {
  comments: ClassifiedComment[];
  nextContinuation: string | null;
  isLoadingMore: boolean;
  backgroundLoadError: string | null;
  onLoadMore: () => void;
  onCorrected: (commentId: string, category: Tab) => void;
  fetchReplies: AppProps["fetchReplies"];
  submitCorrection: AppProps["submitCorrection"];
}

function ResultsView({
  comments,
  nextContinuation,
  isLoadingMore,
  backgroundLoadError,
  onLoadMore,
  onCorrected,
  fetchReplies,
  submitCorrection,
}: ResultsViewProps) {
  const groups = useMemo(() => groupByTab(comments), [comments]);
  const [activeTab, setActiveTab] = useState<Tab>(TABS[0]?.id ?? "positivo");
  const activeComments = groups.get(activeTab) ?? [];

  return (
    <div class="cg-root">
      <div class="cg-tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            class={activeTab === tab.id ? "cg-tab cg-tab--active" : "cg-tab"}
            onClick={() => setActiveTab(tab.id)}
          >
            <span class="cg-tab-icon" aria-hidden="true">
              {TAB_ICONS[tab.id]}
            </span>
            {tab.label}
            <span class="cg-tab-count">({groups.get(tab.id)?.length ?? 0})</span>
          </button>
        ))}
      </div>

      {activeTab === "toxico" && (
        <p class="cg-warning">
          <span aria-hidden="true">⚠️</span> No se recomienda leer esta pestaña: puede contener insultos, acoso o amenazas.
        </p>
      )}

      {activeComments.length === 0 ? (
        <p class="cg-intro">{isLoadingMore ? "Clasificando comentarios…" : "No hay comentarios en esta pestaña."}</p>
      ) : (
        <ul class="cg-comment-list">
          {activeComments.map((comment) => (
            <CommentRow
              key={comment.id}
              comment={comment}
              onCorrected={onCorrected}
              fetchReplies={fetchReplies}
              submitCorrection={submitCorrection}
            />
          ))}
        </ul>
      )}

      {isLoadingMore ? (
        <p class="cg-loading cg-load-more">
          <Spinner />
          Cargando más comentarios en segundo plano…
        </p>
      ) : (
        nextContinuation && (
          <button type="button" class="cg-button cg-load-more" onClick={onLoadMore}>
            Cargar más
          </button>
        )
      )}
      {backgroundLoadError && <p class="cg-error">No se pudieron cargar más comentarios: {backgroundLoadError}</p>}
    </div>
  );
}

export function App({ onUnfiltered, fetchClassifiedComments, fetchReplies, submitCorrection }: AppProps) {
  const [state, setState] = useState<ViewState>({ kind: "choice" });
  const [backgroundLoadError, setBackgroundLoadError] = useState<string | null>(null);

  // Used for both the initial "Filtrados" click (continuation undefined) and "Cargar
  // más" (continuation set): either way, comments already on screen stay there — new
  // batches are appended as they arrive instead of blocking behind a full-page spinner,
  // so the user can start reading the first batch while the rest loads in the background.
  async function loadComments(continuation?: string) {
    const isInitialLoad = !continuation;
    if (isInitialLoad) setState({ kind: "loading" });

    let collected = !isInitialLoad && state.kind === "results" ? [...state.comments] : [];

    try {
      const iterator = fetchClassifiedComments(continuation);
      let result = await iterator.next();
      while (!result.done) {
        collected = [...collected, ...result.value];
        setState({ kind: "results", comments: collected, nextContinuation: null, isLoadingMore: true });
        result = await iterator.next();
      }
      setState({ kind: "results", comments: collected, nextContinuation: result.value, isLoadingMore: false });
      setBackgroundLoadError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      if (collected.length > 0) {
        // Keep what's already loaded on screen; only report that the rest failed.
        setState({ kind: "results", comments: collected, nextContinuation: null, isLoadingMore: false });
        setBackgroundLoadError(message);
      } else {
        setState({ kind: "error", message });
      }
    }
  }

  function handleCorrected(commentId: string, category: Tab) {
    setState((prev) => {
      if (prev.kind !== "results") return prev;
      return { ...prev, comments: prev.comments.map((comment) => (comment.id === commentId ? { ...comment, category } : comment)) };
    });
  }

  switch (state.kind) {
    case "choice":
      return (
        <div class="cg-root">
          <p class="cg-intro">¿Cómo quieres ver los comentarios?</p>
          <div class="cg-buttons">
            <button type="button" class="cg-button" onClick={onUnfiltered}>
              Sin filtrar
            </button>
            <button type="button" class="cg-button cg-button--primary" onClick={() => loadComments()}>
              Filtrados
            </button>
          </div>
        </div>
      );

    case "loading":
      return (
        <div class="cg-root">
          <p class="cg-loading">
            <Spinner />
            Cargando los primeros comentarios…
          </p>
        </div>
      );

    case "error":
      return (
        <div class="cg-root">
          <p class="cg-error">No se pudieron cargar los comentarios: {state.message}</p>
          <button type="button" class="cg-button" onClick={() => setState({ kind: "choice" })}>
            Volver a intentar
          </button>
        </div>
      );

    case "results":
      return (
        <ResultsView
          comments={state.comments}
          nextContinuation={state.nextContinuation}
          isLoadingMore={state.isLoadingMore}
          backgroundLoadError={backgroundLoadError}
          onLoadMore={() => loadComments(state.nextContinuation ?? undefined)}
          onCorrected={handleCorrected}
          fetchReplies={fetchReplies}
          submitCorrection={submitCorrection}
        />
      );
  }
}
