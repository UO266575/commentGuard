import { useMemo, useState } from "preact/hooks";
import { TABS, type Tab } from "@comment-classificator/shared";
import type { ClassifiedComment } from "../classification/pipeline";

type ViewState =
  | { kind: "choice" }
  | { kind: "loading"; count: number }
  | { kind: "results"; comments: ClassifiedComment[] }
  | { kind: "error"; message: string };

export interface AppProps {
  onUnfiltered: () => void;
  // Returns an async generator rather than a promise so the UI can fill tabs as batches
  // of ~20 classified comments arrive, instead of waiting for all 300 at once.
  fetchClassifiedComments: () => AsyncGenerator<ClassifiedComment[]>;
}

function groupByTab(comments: ClassifiedComment[]): Map<Tab, ClassifiedComment[]> {
  const groups = new Map<Tab, ClassifiedComment[]>(TABS.map((tab) => [tab.id, []]));
  for (const comment of comments) groups.get(comment.category)?.push(comment);
  return groups;
}

function ResultsView({ comments }: { comments: ClassifiedComment[] }) {
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
            <li key={comment.id} class="cg-comment">
              {comment.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function App({ onUnfiltered, fetchClassifiedComments }: AppProps) {
  const [state, setState] = useState<ViewState>({ kind: "choice" });

  async function handleFiltered() {
    setState({ kind: "loading", count: 0 });

    const collected: ClassifiedComment[] = [];
    try {
      for await (const batch of fetchClassifiedComments()) {
        collected.push(...batch);
        setState({ kind: "loading", count: collected.length });
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
      return <ResultsView comments={state.comments} />;
  }
}
