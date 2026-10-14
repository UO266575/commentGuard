import { useState } from "preact/hooks";
import type { RawComment } from "@comment-classificator/shared";

type ViewState =
  | { kind: "choice" }
  | { kind: "loading"; fetched: number }
  | { kind: "results"; comments: RawComment[] }
  | { kind: "error"; message: string };

export interface AppProps {
  onUnfiltered: () => void;
  // Returns an async generator rather than a promise so the UI can show progress as
  // batches of ~20 comments arrive, instead of waiting for all 300 at once.
  fetchComments: () => AsyncGenerator<RawComment[]>;
}

export function App({ onUnfiltered, fetchComments }: AppProps) {
  const [state, setState] = useState<ViewState>({ kind: "choice" });

  async function handleFiltered() {
    setState({ kind: "loading", fetched: 0 });

    const collected: RawComment[] = [];
    try {
      for await (const batch of fetchComments()) {
        collected.push(...batch);
        setState({ kind: "loading", fetched: collected.length });
      }
      setState({ kind: "results", comments: collected });
    } catch (error) {
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
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
          <p class="cg-intro">Cargando comentarios… ({state.fetched})</p>
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
        <div class="cg-root">
          <p class="cg-intro">
            {state.comments.length} comentarios cargados. La clasificación por categorías llega en una
            fase posterior; de momento se muestran sin clasificar.
          </p>
          <ul class="cg-comment-list">
            {state.comments.map((comment) => (
              <li key={comment.id} class="cg-comment">
                {comment.text}
              </li>
            ))}
          </ul>
        </div>
      );
  }
}
