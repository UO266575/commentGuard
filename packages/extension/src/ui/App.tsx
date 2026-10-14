import { useMemo, useState } from "preact/hooks";
import { TABS, type RawComment, type Tab } from "@comment-classificator/shared";
import type { ClassifiedComment } from "../classification/pipeline";

type ViewState =
  | { kind: "choice" }
  | { kind: "loading"; count: number }
  | { kind: "results"; comments: ClassifiedComment[]; nextContinuation: string | null }
  | { kind: "error"; message: string };

export interface AppProps {
  onUnfiltered: () => void;
  // Returns an async generator rather than a promise so the UI can fill tabs as batches
  // of ~20 classified comments arrive, instead of waiting for all 300 at once. Pass a
  // continuation to resume a previous call instead of starting over (see "Cargar más").
  fetchClassifiedComments: (continuation?: string) => AsyncGenerator<ClassifiedComment[], string | null>;
  fetchReplies: (continuation: string) => Promise<{ replies: RawComment[]; nextContinuation: string | null }>;
  submitCorrection: (correction: { commentId: string; originalCategory: Tab; correctedCategory: Tab }) => Promise<void>;
}

function groupByTab(comments: ClassifiedComment[]): Map<Tab, ClassifiedComment[]> {
  const groups = new Map<Tab, ClassifiedComment[]>(TABS.map((tab) => [tab.id, []]));
  for (const comment of comments) groups.get(comment.category)?.push(comment);
  return groups;
}

interface CommentRowProps {
  comment: ClassifiedComment;
  onCorrected: (commentId: string, category: Tab) => void;
  fetchReplies: AppProps["fetchReplies"];
  submitCorrection: AppProps["submitCorrection"];
}

function CommentRow({ comment, onCorrected, fetchReplies, submitCorrection }: CommentRowProps) {
  const [replies, setReplies] = useState<RawComment[] | null>(null);
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
              {reply.text}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

interface ResultsViewProps {
  comments: ClassifiedComment[];
  nextContinuation: string | null;
  loadingMore: boolean;
  loadMoreError: string | null;
  onLoadMore: () => void;
  onCorrected: (commentId: string, category: Tab) => void;
  fetchReplies: AppProps["fetchReplies"];
  submitCorrection: AppProps["submitCorrection"];
}

function ResultsView({
  comments,
  nextContinuation,
  loadingMore,
  loadMoreError,
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
            {tab.label} ({groups.get(tab.id)?.length ?? 0})
          </button>
        ))}
      </div>

      {activeTab === "toxico" && (
        <p class="cg-warning">No se recomienda leer esta pestaña: puede contener insultos, acoso o amenazas.</p>
      )}

      {activeComments.length === 0 ? (
        <p class="cg-intro">No hay comentarios en esta pestaña.</p>
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

      {nextContinuation && (
        <button type="button" class="cg-button" onClick={onLoadMore} disabled={loadingMore}>
          {loadingMore ? "Cargando más…" : "Cargar más"}
        </button>
      )}
      {loadMoreError && <p class="cg-error">No se pudieron cargar más comentarios: {loadMoreError}</p>}
    </div>
  );
}

export function App({ onUnfiltered, fetchClassifiedComments, fetchReplies, submitCorrection }: AppProps) {
  const [state, setState] = useState<ViewState>({ kind: "choice" });
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  async function handleFiltered() {
    setState({ kind: "loading", count: 0 });

    const collected: ClassifiedComment[] = [];
    try {
      const iterator = fetchClassifiedComments();
      let result = await iterator.next();
      while (!result.done) {
        collected.push(...result.value);
        setState({ kind: "loading", count: collected.length });
        result = await iterator.next();
      }
      setState({ kind: "results", comments: collected, nextContinuation: result.value });
    } catch (error) {
      setState({ kind: "error", message: error instanceof Error ? error.message : "Error desconocido" });
    }
  }

  async function handleLoadMore() {
    if (state.kind !== "results" || !state.nextContinuation || loadingMore) return;

    setLoadingMore(true);
    setLoadMoreError(null);
    const collected = [...state.comments];
    try {
      const iterator = fetchClassifiedComments(state.nextContinuation);
      let result = await iterator.next();
      while (!result.done) {
        collected.push(...result.value);
        result = await iterator.next();
      }
      setState({ kind: "results", comments: collected, nextContinuation: result.value });
    } catch (error) {
      // Keep the comments already loaded on screen; only report the failure.
      setLoadMoreError(error instanceof Error ? error.message : "Error desconocido");
    } finally {
      setLoadingMore(false);
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
            <button type="button" class="cg-button cg-button--primary" onClick={handleFiltered}>
              Filtrados
            </button>
          </div>
        </div>
      );

    case "loading":
      return (
        <div class="cg-root">
          <p class="cg-intro">Cargando y clasificando comentarios… ({state.count})</p>
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
          loadingMore={loadingMore}
          loadMoreError={loadMoreError}
          onLoadMore={handleLoadMore}
          onCorrected={handleCorrected}
          fetchReplies={fetchReplies}
          submitCorrection={submitCorrection}
        />
      );
  }
}
