"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useERStore } from "@/store/useERStore";
import { projectsAPI } from "./api";
import {
  lastProjectId,
  rememberProject,
  restoreProject,
} from "./restoreProject";
import type { ProjectSummary } from "./types";
import type { ERGraph } from "../ast/types";
export function useProjects() {
  const graph = useERStore((s) => s.graph);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [current, setCurrent] = useState<ProjectSummary | null>(null);
  const [savedGraph, setSavedGraph] = useState<ERGraph | null>(graph);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(true);
  const [restoring, setRestoring] = useState(true);
  const [restoreError, setRestoreError] = useState("");
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const [error, setError] = useState("");
  const locked = useRef(true);
  const restoreCancelled = useRef(false);
  const dirty = graph !== savedGraph;
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setProjects(await projectsAPI.list());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load projects");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const load = useCallback((g: ERGraph, project: ProjectSummary | null) => {
    useERStore.setState({
      graph: g,
      past: [],
      future: [],
      selection: null,
      selectedIds: [],
      attributeFocus: null,
      transactionBase: null,
    });
    setCurrent(project);
    setSavedGraph(g);
    if (project) rememberProject(project.id);
  }, []);
  useEffect(() => {
    let cancelled = false;
    restoreCancelled.current = false;
    locked.current = true;
    setBusy(true);
    setRestoring(true);
    setRestoreError("");
    void restoreProject(projectsAPI, lastProjectId())
      .then((result) => {
        if (cancelled || restoreCancelled.current) return;
        setProjects(result.projects);
        if (result.current) load(result.current.graph, result.current);
        setRestoring(false);
        locked.current = false;
        setBusy(false);
      })
      .catch((cause: unknown) => {
        if (!cancelled && !restoreCancelled.current)
          setRestoreError(
            cause instanceof Error
              ? cause.message
              : "Could not reopen your project.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [load, restoreAttempt]);
  const save = async (asCopy = false): Promise<boolean> => {
    if (locked.current) return false;
    locked.current = true;
    setBusy(true);
    setError("");
    const snapshot = useERStore.getState().graph;
    try {
      const record = await projectsAPI.save(snapshot, asCopy ? null : current);
      setCurrent(record);
      rememberProject(record.id);
      setSavedGraph(snapshot);
      setProjects((list) => [
        record,
        ...list.filter((p) => p.id !== record.id),
      ]);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      return false;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  const open = async (id: string) => {
    if (locked.current) return false;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      const p = await projectsAPI.open(id);
      load(p.graph, p);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Open failed");
      return false;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  const create = async (name: string) => {
    if (locked.current) return false;
    locked.current = true;
    setBusy(true);
    setError("");
    const g: ERGraph = {
      version: 1,
      name: name.trim(),
      entities: [],
      relationships: [],
      specializations: [],
    };
    try {
      const p = await projectsAPI.save(g, null);
      load(p.graph, p);
      setProjects((list) => [p, ...list]);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
      return false;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  return {
    projects,
    restoring,
    restoreError,
    retryRestore: () => setRestoreAttempt((attempt) => attempt + 1),
    continueWithoutStorage: () => {
      restoreCancelled.current = true;
      locked.current = false;
      setBusy(false);
      setRestoring(false);
      setRestoreError("");
      setError(
        "Project storage is unavailable. You can edit and import diagrams; download a JSON backup to keep your changes.",
      );
    },
    current,
    loading,
    busy,
    error,
    setError,
    dirty,
    refresh,
    save,
    open,
    create,
    importModel: (g: ERGraph) => {
      load(g, null);
      setSavedGraph(null);
    },
  };
}
