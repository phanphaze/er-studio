"use client";
import {
  Database,
  ChevronDown,
  Download,
  Table2,
  GitBranch,
  Layers3,
  PanelRightClose,
  PanelRightOpen,
  Save,
  FolderOpen,
} from "lucide-react";
import { useMemo, useState, useRef } from "react";
import { ERCanvas } from "./canvas/ERCanvas";
import { InspectorPanel } from "./panels/InspectorPanel";
import { Toolbar } from "./panels/Toolbar";
import { Button } from "./ui/button";
import { useERStore } from "@/store/useERStore";
import { parseModel } from "@/lib/ast/serialization";
import { downloadText } from "./panels/SqlPreviewPanel";
import { compileGraph } from "@/lib/compiler/sqlGenerator";
export function ERWorkspace() {
  const graph = useERStore((s) => s.graph);
  const selection = useERStore((s) => s.selection);
  const [inspector, setInspector] = useState(true);
  const [filter, setFilter] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState("");
  const result = useMemo(() => compileGraph(graph), [graph]);
  return (
    <main className="app-shell">
      <header className="app-header">
        <a href="/" className="brand">
          <span className="brand-icon">
            <Database size={21} />
          </span>
          ER<span className="brand-light">studio</span>
          <span className="beta">BETA</span>
        </a>
        <div className="header-breadcrumb">
          Workspace <span>/</span> <strong>{graph.name}</strong>
        </div>
        <div className="header-actions">
          <input
            ref={fileRef}
            hidden
            type="file"
            accept=".json"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              try {
                if (file.size > 5_000_000)
                  throw Error("Model exceeds the 5 MB limit.");
                useERStore
                  .getState()
                  .replaceGraph(parseModel(await file.text()));
                setFileError("");
              } catch (error) {
                setFileError(
                  error instanceof Error
                    ? error.message
                    : "Could not open model",
                );
              }
              event.target.value = "";
            }}
          />
          <Button
            variant="ghost"
            size="icon"
            title="Open model JSON (undo to restore current model)"
            onClick={() => fileRef.current?.click()}
          >
            <FolderOpen size={17} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Save model JSON"
            onClick={() =>
              downloadText(
                JSON.stringify(graph, null, 2),
                "model.er.json",
                "application/json",
              )
            }
          >
            <Save size={17} />
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              document.getElementById("export-sql-action")?.click()
            }
          >
            <Download size={15} />
            <span>Export SQL</span>
          </Button>
          <button className="avatar" title="Current workspace">
            CC
          </button>
        </div>
      </header>
      <div className="workspace-body">
        {fileError && (
          <div className="notice" role="alert">
            {fileError}
            <button onClick={() => setFileError("")}>Dismiss</button>
          </div>
        )}
        <nav className="schema-sidebar">
          <div className="sidebar-project">
            <span className="project-icon">
              <Layers3 size={19} />
            </span>
            <div>
              <strong>Commerce</strong>
              <small>Database model</small>
            </div>
            <ChevronDown size={15} />
          </div>
          <label className="entity-search">
            <input
              placeholder="Filter entities…"
              aria-label="Filter entities"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <span>⌕</span>
          </label>
          <div className="sidebar-heading">
            EXPLORER <span>{graph.entities.length}</span>
          </div>
          <div className="schema-label">
            <ChevronDown size={13} />
            <Database size={14} /> public
          </div>
          {graph.entities
            .filter((e) => e.name.toLowerCase().includes(filter.toLowerCase()))
            .map((e) => (
              <button
                className={`explorer-entity ${selection?.id === e.id ? "active" : ""}`}
                key={e.id}
                onClick={() =>
                  useERStore
                    .getState()
                    .setSelection({ kind: "entity", id: e.id })
                }
              >
                <Table2 size={15} style={{ color: e.color }} />
                <span>{e.name}</span>
                <small>{e.attributes.length}</small>
              </button>
            ))}
          <button
            className="sidebar-add"
            onClick={() => useERStore.getState().addEntity()}
          >
            + Add entity
          </button>
          <div className="sidebar-heading relationships-heading">
            RELATIONSHIPS <span>{graph.relationships.length}</span>
          </div>
          {graph.relationships.map((r) => (
            <button
              className={`explorer-entity ${selection?.id === r.id ? "active" : ""}`}
              key={r.id}
              onClick={() =>
                useERStore
                  .getState()
                  .setSelection({ kind: "relationship", id: r.id })
              }
            >
              <GitBranch size={14} />
              <span>{r.name}</span>
              <small>{r.cardinality}</small>
            </button>
          ))}
          <div className="sidebar-bottom">
            <div className="postgres-icon">Pg</div>
            <div>
              <strong>PostgreSQL</strong>
              <small>Target dialect</small>
            </div>
          </div>
        </nav>
        <section className="model-area">
          <div className="model-title">
            <div>
              <div className="eyebrow">SCHEMA DESIGNER</div>
              <h1>
                {graph.name}
                <span className="version-tag">v1</span>
              </h1>
            </div>
            <Button
              variant="ghost"
              size="icon"
              title="Toggle inspector"
              onClick={() => setInspector(!inspector)}
            >
              {inspector ? (
                <PanelRightClose size={19} />
              ) : (
                <PanelRightOpen size={19} />
              )}
            </Button>
          </div>
          <Toolbar />
          <div className="canvas-container">
            <ERCanvas />
          </div>
          <footer className="status-bar">
            <span
              className={result.sql ? "valid-indicator" : "error-indicator"}
            >
              {result.sql ? "● Model valid" : "● Needs attention"}
            </span>
            <span>{graph.entities.length} entities</span>
            <span>{graph.relationships.length} relationships</span>
            <span className="status-right">
              Snap to grid <strong>20 px</strong>
            </span>
          </footer>
        </section>
        {inspector && <InspectorPanel />}
      </div>
    </main>
  );
}
