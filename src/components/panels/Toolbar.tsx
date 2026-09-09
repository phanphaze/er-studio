"use client";
import { useEffect, useState } from "react";
import {
  Command,
  Plus,
  Undo2,
  Redo2,
  Download,
  Search,
  X,
  GitBranch,
  WandSparkles,
} from "lucide-react";
import { useERStore } from "@/store/useERStore";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { compileGraph } from "@/lib/compiler/sqlGenerator";
import type { Notation } from "@/lib/ast/types";
import { downloadText } from "./SqlPreviewPanel";
export function Toolbar({
  onOrganize,
  onAlign,
}: {
  onOrganize: () => Promise<void> | undefined;
  onAlign: (mode: string) => void;
}) {
  const [organizing, setOrganizing] = useState(false);
  const graph = useERStore((s) => s.graph);
  const notation = useERStore((s) => s.notation);
  const past = useERStore((s) => s.past.length);
  const future = useERStore((s) => s.future.length);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isa, setIsa] = useState(false);
  const [parent, setParent] = useState("");
  const [children, setChildren] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      const tag = (e.target as HTMLElement).tagName;
      if (
        ["INPUT", "TEXTAREA", "SELECT"].includes(tag) ||
        (e.target as HTMLElement).isContentEditable
      )
        return;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) useERStore.getState().redo();
        else useERStore.getState().undo();
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        useERStore.getState().redo();
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        const s = useERStore.getState();
        if (s.selection) {
          e.preventDefault();
          if (s.selection.kind === "entity") s.deleteEntity(s.selection.id);
          else if (s.selection.kind === "relationship")
            s.deleteRelationship(s.selection.id);
          else s.deleteSpecialization(s.selection.id);
        }
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
  return (
    <>
      <div className="workspace-toolbar">
        <div className="notation-switch" aria-label="Diagram notation">
          {(
            [
              ["crows-foot", "Crow’s Foot"],
              ["chen", "Chen"],
              ["uml", "UML"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              className={notation === id ? "active" : ""}
              onClick={() => useERStore.getState().setNotation(id as Notation)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="toolbar-divider" />
        <Button
          variant="ghost"
          size="icon"
          title="Undo (⌘Z)"
          disabled={!past}
          onClick={() => useERStore.getState().undo()}
        >
          <Undo2 size={17} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title="Redo (⌘⇧Z)"
          disabled={!future}
          onClick={() => useERStore.getState().redo()}
        >
          <Redo2 size={17} />
        </Button>
        <div className="toolbar-spacer" />
        <select
          className="alignment-select"
          aria-label="Align selected entities, or all entities"
          value=""
          onChange={(e) => onAlign(e.target.value)}
        >
          <option value="" disabled>
            Align…
          </option>
          <option value="top">Top edges</option>
          <option value="middle">Horizontal centers</option>
          <option value="bottom">Bottom edges</option>
          <option value="left">Left edges</option>
          <option value="center">Vertical centers</option>
          <option value="right">Right edges</option>
          <option value="horizontal">Distribute horizontally</option>
          <option value="vertical">Distribute vertically</option>
        </select>
        <Button
          variant="outline"
          disabled={organizing}
          title="Organize the current diagram"
          onClick={async () => {
            setOrganizing(true);
            try {
              await onOrganize();
            } catch (e) {
              setNotice(e instanceof Error ? e.message : "Layout failed");
            } finally {
              setOrganizing(false);
            }
          }}
        >
          <WandSparkles size={15} />
          {organizing ? "Organizing…" : "Auto-organize"}
        </Button>
        <Button
          variant="ghost"
          className="command-button"
          onClick={() => setOpen(true)}
        >
          <Search size={16} />
          <span>Commands</span>
          <kbd>⌘ K</kbd>
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setParent(graph.entities[0]?.id ?? "");
            setChildren([]);
            setIsa(true);
          }}
        >
          <GitBranch size={16} />
          <span>ISA</span>
        </Button>
        <Button onClick={() => useERStore.getState().addEntity()}>
          <Plus size={16} />
          <span>Entity</span>
        </Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle className="command-title">
            <Command size={20} /> Command center
          </DialogTitle>
          <DialogDescription className="muted">
            Find an entity, or type a name to create one.
          </DialogDescription>
          <input
            autoFocus
            className="command-input"
            aria-label="Entity name or command"
            placeholder="Create or find an entity…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                useERStore.getState().addEntity(query || "untitled");
                setOpen(false);
                setQuery("");
              }
            }}
          />
          <button
            className="command-result"
            onClick={() => {
              useERStore.getState().addEntity(query || "untitled");
              setOpen(false);
              setQuery("");
            }}
          >
            <Plus size={18} /> Create {query ? `“${query}”` : "entity"}
            <kbd>↵</kbd>
          </button>
          {graph.entities
            .filter((e) => e.name.toLowerCase().includes(query.toLowerCase()))
            .map((e) => (
              <button
                className="command-result"
                key={e.id}
                onClick={() => {
                  useERStore
                    .getState()
                    .setSelection({ kind: "entity", id: e.id });
                  setOpen(false);
                }}
              >
                <span className="entity-dot" style={{ background: e.color }} />
                {e.name}
                <span className="muted">Select entity</span>
              </button>
            ))}
        </DialogContent>
      </Dialog>
      <Dialog open={isa} onOpenChange={setIsa}>
        <DialogContent>
          <DialogTitle>Add specialization</DialogTitle>
          <DialogDescription className="muted">
            Connect a superclass to one or more subclasses.
          </DialogDescription>
          <label className="field-label">
            Superclass
            <select
              value={parent}
              onChange={(e) => {
                setParent(e.target.value);
                setChildren([]);
              }}
            >
              {graph.entities.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
          <div className="field-label">Subclasses</div>
          {graph.entities
            .filter((e) => e.id !== parent)
            .map((e) => (
              <label className="subclass-option" key={e.id}>
                <input
                  type="checkbox"
                  checked={children.includes(e.id)}
                  onChange={(event) =>
                    setChildren(
                      event.target.checked
                        ? [...children, e.id]
                        : children.filter((id) => id !== e.id),
                    )
                  }
                />
                {e.name}
              </label>
            ))}
          <Button
            disabled={!parent || !children.length}
            onClick={() => {
              useERStore.getState().addSpecialization({
                name: "specialization",
                superclassId: parent,
                subclassIds: children,
                disjointness: "disjoint",
                completeness: "partial",
                strategy: "table-per-type",
                position: { x: 400, y: 400 },
              });
              setIsa(false);
            }}
          >
            Add specialization
          </Button>
        </DialogContent>
      </Dialog>
      {notice && (
        <div role="status" className="notice">
          {notice}
          <button aria-label="Dismiss" onClick={() => setNotice("")}>
            <X size={15} />
          </button>
        </div>
      )}
      <button
        id="export-sql-action"
        hidden
        onClick={() => {
          const r = compileGraph(graph);
          if (r.sql) downloadText(r.sql, "schema.sql");
          else setNotice("Resolve validation errors before exporting SQL.");
        }}
      >
        <Download /> Export
      </button>
    </>
  );
}
