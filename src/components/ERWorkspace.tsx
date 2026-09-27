"use client";
import {
  Database,
  Settings,
  ChevronDown,
  ChevronRight,
  Download,
  Table2,
  GitBranch,
  Layers3,
  PanelRightClose,
  PanelRightOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Save,
  FolderOpen,
  FileJson,
  FileDown,
  Plus,
} from "lucide-react";
import { useMemo, useState, useRef, useEffect } from "react";
import { ERCanvas, type CanvasActions } from "./canvas/ERCanvas";
import { InspectorPanel } from "./panels/InspectorPanel";
import { Toolbar } from "./panels/Toolbar";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { useERStore } from "@/store/useERStore";
import { relationshipCardinality } from "@/lib/ast/participation";
import { parseModel } from "@/lib/ast/serialization";
import { downloadText } from "./panels/SqlPreviewPanel";
import { compileGraph } from "@/lib/compiler/sqlGenerator";
import { SettingsPanel } from "./panels/SettingsPanel";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useProjects } from "@/lib/projects/useProjects";
import { ProjectBrowser } from "./projects/ProjectBrowser";
import { PanelDivider } from "./layout/PanelDivider";
export function ERWorkspace() {
  const graph = useERStore((s) => s.graph),
    selection = useERStore((s) => s.selection);
  const projects = useProjects();
  const appearance = useSettingsStore();
  const [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => {
    appearance.initialize();
  }, []);
  useEffect(() => {
    document.documentElement.dataset.mode = appearance.mode;
    document.documentElement.dataset.accent = appearance.accent;
    document.documentElement.dataset.contrast = appearance.contrast;
    document.documentElement.classList.toggle(
      "dark",
      appearance.mode === "dark",
    );
  }, [appearance.mode, appearance.accent, appearance.contrast]);
  const attributeFocus = useERStore((s) => s.attributeFocus);
  useEffect(() => {
    if (attributeFocus) setRightWidth((w) => (w === 0 ? 324 : w));
  }, [attributeFocus]);
  const [view, setView] = useState<"editor" | "projects">("editor");
  const [leftWidth, setLeftWidth] = useState(218),
    [rightWidth, setRightWidth] = useState(324);
  const [entitiesOpen, setEntitiesOpen] = useState(true),
    [relationshipsOpen, setRelationshipsOpen] = useState(true);
  const [filter, setFilter] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<CanvasActions>(null);
  const [notice, setNotice] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(timer);
  }, [notice]);
  const [newOpen, setNewOpen] = useState(false),
    [newName, setNewName] = useState("Untitled project");
  const [pending, setPending] = useState<(() => void) | null>(null);
  const result = useMemo(() => compileGraph(graph), [graph]);
  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem("er-panel-widths") ?? "null");
      if (p && Number.isFinite(p.left) && Number.isFinite(p.right)) {
        setLeftWidth(Math.max(0, Math.min(480, p.left)));
        setRightWidth(Math.max(0, Math.min(480, p.right)));
      } else if (window.innerWidth < 720) {
        setLeftWidth(0);
        setRightWidth(0);
      }
    } catch {
      /* Preferences are optional. */
    }
  }, []);
  const resize = (side: "left" | "right", value: number) => {
    const left = side === "left" ? value : leftWidth,
      right = side === "right" ? value : rightWidth;
    setLeftWidth(left);
    setRightWidth(right);
    try {
      localStorage.setItem("er-panel-widths", JSON.stringify({ left, right }));
    } catch {
      /* Keep current layout even if preferences cannot be stored. */
    }
  };
  const guard = (action: () => void) => {
    if (projects.busy) return;
    if (projects.dirty) setPending(() => action);
    else action();
  };
  const browse = () => {
    setView("projects");
    void projects.refresh();
  };
  const save = async () => {
    if (await projects.save()) setNotice("Project saved.");
  };
  useEffect(() => {
    const onSaveShortcut = (event: KeyboardEvent) => {
      if (
        !(event.ctrlKey || event.metaKey) ||
        event.altKey ||
        event.shiftKey ||
        event.key.toLowerCase() !== "s"
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat && view === "editor" && !projects.busy) void save();
    };
    window.addEventListener("keydown", onSaveShortcut, true);
    return () => window.removeEventListener("keydown", onSaveShortcut, true);
  }, [view, projects.busy, projects.save]);
  const open = (id: string) =>
    guard(() => {
      void projects.open(id).then((ok) => {
        if (ok) setView("editor");
      });
    });
  const newProject = () =>
    guard(() => {
      setNewName("Untitled project");
      setNewOpen(true);
    });
  const importFile = () => guard(() => fileRef.current?.click());
  if (projects.restoring)
    return (
      <main className="project-restore-screen">
        <Database size={32} aria-hidden="true" />
        <h1>
          {projects.restoreError
            ? "Could not reopen your project"
            : "Opening your workspace…"}
        </h1>
        <p role={projects.restoreError ? "alert" : "status"}>
          {projects.restoreError || "Restoring your last opened project."}
        </p>
        {projects.restoreError && (
          <Button onClick={projects.retryRestore}>Try again</Button>
        )}
      </main>
    );
  return (
    <main className="app-shell">
      <header className="app-header">
        <button
          className="brand brand-button"
          onClick={browse}
          aria-label="Open workspace projects"
        >
          <span className="brand-icon">
            <Database size={21} />
          </span>
          ER<span className="brand-light">studio</span>
        </button>
        <div className="header-breadcrumb">
          <button
            onClick={browse}
            aria-current={view === "projects" ? "page" : undefined}
          >
            Workspace
          </button>
          {view === "editor" && (
            <>
              <span>/</span>
              <strong>{graph.name}</strong>
            </>
          )}
        </div>
        <div className="header-actions">
          <Button
            variant="ghost"
            size="icon"
            title="Settings"
            aria-label="Open settings"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings size={18} />
          </Button>
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
                projects.importModel(parseModel(await file.text()));
                setView("editor");
                projects.setError("");
              } catch (error) {
                projects.setError(
                  error instanceof Error
                    ? error.message
                    : "Could not open model",
                );
              }
              event.target.value = "";
            }}
          />
          {view === "editor" && (
            <>
              <span className="save-state" aria-live="polite">
                {projects.busy
                  ? "Saving / loading…"
                  : projects.dirty
                    ? "Unsaved changes"
                    : projects.current
                      ? "Saved"
                      : "Example · not saved"}
              </span>
              <Button
                variant="ghost"
                size="icon"
                title="Import model JSON"
                aria-label="Import model JSON"
                disabled={projects.busy}
                onClick={importFile}
              >
                <FolderOpen size={17} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title="Download JSON backup"
                aria-label="Download JSON backup"
                onClick={() =>
                  downloadText(
                    JSON.stringify(graph, null, 2),
                    "model.er.json",
                    "application/json",
                  )
                }
              >
                <FileJson size={17} />
              </Button>
              <Button
                variant="outline"
                disabled={projects.busy}
                title="Save project (Ctrl+S / ⌘S)"
                onClick={() => void save()}
              >
                <Save size={15} />
                <span>Save project</span>
              </Button>
              <Button
                variant="outline"
                disabled={pdfBusy || graph.entities.length === 0}
                onClick={async () => {
                  setPdfBusy(true);
                  try {
                    if (!canvasRef.current) throw Error("Canvas is not ready.");
                    await canvasRef.current.exportPdf();
                    setNotice("PDF exported.");
                  } catch (e) {
                    projects.setError(
                      e instanceof Error ? e.message : "PDF export failed.",
                    );
                  } finally {
                    setPdfBusy(false);
                  }
                }}
              >
                <FileDown size={15} />
                <span>{pdfBusy ? "Exporting…" : "PDF"}</span>
              </Button>
              <Button
                variant="outline"
                disabled={!result.sql}
                onClick={() => downloadText(result.sql, "schema.sql")}
              >
                <Download size={15} />
                <span>SQL</span>
              </Button>
            </>
          )}
        </div>
      </header>
      {(projects.error || notice) && (
        <div className="notice" role={projects.error ? "alert" : "status"}>
          {projects.error || notice}
          <button
            onClick={() => {
              projects.setError("");
              setNotice("");
            }}
          >
            Dismiss
          </button>
          {projects.error.includes("another tab") && view === "editor" && (
            <Button
              variant="outline"
              size="sm"
              disabled={projects.busy}
              onClick={() => void projects.save(true)}
            >
              Save as new project
            </Button>
          )}
        </div>
      )}
      {view === "projects" ? (
        <ProjectBrowser
          projects={projects.projects}
          loading={projects.loading}
          busy={projects.busy}
          onOpen={open}
          onNew={newProject}
          onImport={importFile}
          onRefresh={() => void projects.refresh()}
          onResume={() => setView("editor")}
        />
      ) : (
        <div
          className="workspace-body"
          style={
            {
              "--left-panel-width": `${leftWidth}px`,
              "--right-panel-width": `${rightWidth}px`,
            } as React.CSSProperties
          }
        >
          {leftWidth > 0 && (
            <nav className="schema-sidebar">
              <button
                className="sidebar-project project-switcher"
                onClick={browse}
                title="Open projects"
              >
                <span className="project-icon">
                  <Layers3 size={19} />
                </span>
                <div>
                  <strong>{graph.name}</strong>
                  <small>Browse projects</small>
                </div>
                <ChevronDown size={15} />
              </button>
              <Button
                variant="outline"
                className="sidebar-new"
                disabled={projects.busy}
                onClick={newProject}
              >
                <Plus size={14} />
                New project
              </Button>
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
                EXPLORER<span>{graph.entities.length}</span>
              </div>
              <button
                className="schema-label section-toggle"
                aria-expanded={entitiesOpen}
                aria-controls="entity-list"
                onClick={() => setEntitiesOpen(!entitiesOpen)}
              >
                {entitiesOpen ? (
                  <ChevronDown size={13} />
                ) : (
                  <ChevronRight size={13} />
                )}
                <Database size={14} /> public
              </button>
              {entitiesOpen && (
                <div id="entity-list">
                  {graph.entities
                    .filter((e) =>
                      e.name.toLowerCase().includes(filter.toLowerCase()),
                    )
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
                </div>
              )}
              <button
                className="sidebar-heading relationships-heading section-toggle"
                aria-expanded={relationshipsOpen}
                aria-controls="relationship-list"
                onClick={() => setRelationshipsOpen(!relationshipsOpen)}
              >
                {relationshipsOpen ? (
                  <ChevronDown size={13} />
                ) : (
                  <ChevronRight size={13} />
                )}{" "}
                RELATIONSHIPS <span>{graph.relationships.length}</span>
              </button>
              {relationshipsOpen && (
                <div id="relationship-list">
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
                      <small>{relationshipCardinality(r.endpoints)}</small>
                    </button>
                  ))}
                </div>
              )}
              <div className="sidebar-bottom">
                <div className="postgres-icon">Pg</div>
                <div>
                  <strong>PostgreSQL</strong>
                  <small>Target dialect</small>
                </div>
              </div>
            </nav>
          )}
          <PanelDivider
            side="left"
            width={leftWidth}
            onChange={(width) => resize("left", width)}
          />
          <section className="model-area">
            <div className="model-title">
              <Button
                variant="ghost"
                size="icon"
                title={leftWidth ? "Collapse explorer" : "Open explorer"}
                aria-label={leftWidth ? "Collapse explorer" : "Open explorer"}
                onClick={() => resize("left", leftWidth ? 0 : 218)}
              >
                {leftWidth ? (
                  <PanelLeftClose size={19} />
                ) : (
                  <PanelLeftOpen size={19} />
                )}
              </Button>
              <div className="model-title-text">
                <div className="eyebrow">SCHEMA DESIGNER</div>
                <input
                  className="project-title-input"
                  aria-label="Project name"
                  value={graph.name}
                  onFocus={() => useERStore.getState().beginTransaction()}
                  onBlur={() => useERStore.getState().endTransaction()}
                  onChange={(e) =>
                    useERStore.getState().commit((g) => {
                      g.name = e.target.value;
                    })
                  }
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                title={rightWidth ? "Collapse inspector" : "Open inspector"}
                aria-label={
                  rightWidth ? "Collapse inspector" : "Open inspector"
                }
                onClick={() => resize("right", rightWidth ? 0 : 324)}
              >
                {rightWidth ? (
                  <PanelRightClose size={19} />
                ) : (
                  <PanelRightOpen size={19} />
                )}
              </Button>
            </div>
            <Toolbar
              onOrganize={() => canvasRef.current?.organize()}
              onAlign={(mode) => canvasRef.current?.align(mode)}
            />
            <div className="canvas-container">
              <ERCanvas actionsRef={canvasRef} />
            </div>
            <footer className="status-bar">
              <span
                className={result.sql ? "valid-indicator" : "error-indicator"}
              >
                {result.sql ? "● Model valid" : "● Needs attention"}
              </span>
              <span>{graph.entities.length} entities</span>
              <span>{graph.relationships.length} relationships</span>
              <span className="status-right">Drag panel borders to resize</span>
            </footer>
          </section>
          <PanelDivider
            side="right"
            width={rightWidth}
            onChange={(width) => resize("right", width)}
          />
          {rightWidth > 0 && (
            <div className="inspector-shell">
              <InspectorPanel />
            </div>
          )}
        </div>
      )}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription className="muted">
            Appearance and diagram notation
          </DialogDescription>
          <SettingsPanel />
        </DialogContent>
      </Dialog>
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription className="muted">
            Start with a blank diagram. Your project will be saved to this
            workspace.
          </DialogDescription>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (await projects.create(newName)) {
                setNewOpen(false);
                setView("editor");
              }
            }}
          >
            <label className="field-label">
              Project name
              <input
                autoFocus
                required
                maxLength={256}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </label>
            <Button type="submit" disabled={projects.busy || !newName.trim()}>
              {projects.busy ? "Creating…" : "Create project"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
      >
        <DialogContent>
          <DialogTitle>Save your changes?</DialogTitle>
          <DialogDescription className="muted">
            Save the current diagram before switching projects, or discard the
            unsaved edits.
          </DialogDescription>
          <div className="project-browser-actions">
            <Button
              disabled={projects.busy}
              onClick={async () => {
                if (await projects.save()) {
                  const action = pending;
                  setPending(null);
                  action?.();
                }
              }}
            >
              Save and continue
            </Button>
            <Button
              variant="outline"
              disabled={projects.busy}
              onClick={() => {
                const action = pending;
                setPending(null);
                action?.();
              }}
            >
              Discard and continue
            </Button>
            <Button
              variant="ghost"
              disabled={projects.busy}
              onClick={() => setPending(null)}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
