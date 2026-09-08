"use client";
import { useState } from "react";
import {
  Database,
  Plus,
  FolderOpen,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import { Button } from "../ui/button";
import type { ProjectSummary } from "@/lib/projects/types";
export function ProjectBrowser({
  projects,
  loading,
  busy,
  onOpen,
  onNew,
  onImport,
  onRefresh,
  onResume,
}: {
  projects: ProjectSummary[];
  loading: boolean;
  busy: boolean;
  onOpen: (id: string) => void;
  onNew: () => void;
  onImport: () => void;
  onRefresh: () => void;
  onResume: () => void;
}) {
  const [query, setQuery] = useState("");
  return (
    <section className="project-browser">
      <div className="project-browser-heading">
        <div>
          <div className="eyebrow">YOUR WORKSPACE</div>
          <h1>Projects</h1>
          <p className="muted">
            Create a model or pick up where you left off. Saved projects are
            available across sessions.
          </p>
        </div>
        <div className="project-browser-actions">
          <Button variant="outline" onClick={onImport} disabled={busy}>
            <FolderOpen size={16} />
            Import JSON
          </Button>
          <Button onClick={onNew} disabled={busy}>
            <Plus size={16} />
            New project
          </Button>
        </div>
      </div>
      <div className="project-browser-tools">
        <input
          placeholder="Search projects…"
          aria-label="Search projects"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button variant="ghost" onClick={onRefresh} disabled={loading}>
          <RefreshCw size={15} />
          Refresh
        </Button>
        <Button variant="ghost" onClick={onResume}>
          Return to diagram
          <ArrowRight size={15} />
        </Button>
      </div>
      {loading ? (
        <p role="status">Loading projects…</p>
      ) : (
        <div className="project-grid">
          {projects
            .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
            .map((p) => (
              <button
                className="project-card"
                key={p.id}
                disabled={busy}
                onClick={() => onOpen(p.id)}
              >
                <span className="project-icon">
                  <Database size={22} />
                </span>
                <h2>{p.name}</h2>
                <p>
                  {p.entityCount} entities · {p.relationshipCount} relationships
                </p>
                <small>Saved {new Date(p.updatedAt).toLocaleString()}</small>
              </button>
            ))}
          {!projects.length && (
            <div className="projects-empty">
              <Database size={30} />
              <h2>Your first project starts here.</h2>
              <p>
                Create a blank project, import JSON, or return to the example
                diagram and save it.
              </p>
              <Button onClick={onNew} disabled={busy}>
                <Plus size={16} />
                New project
              </Button>
            </div>
          )}
          {projects.length > 0 &&
            !projects.some((p) =>
              p.name.toLowerCase().includes(query.toLowerCase()),
            ) && <p>No matching projects.</p>}
        </div>
      )}
    </section>
  );
}
