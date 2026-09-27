import type { ProjectSummary, SavedProject } from "./types";

const LAST_PROJECT_KEY = "er-studio:last-project";
export function lastProjectId(): string | null {
  try {
    return localStorage.getItem(LAST_PROJECT_KEY);
  } catch {
    return null;
  }
}
export function rememberProject(id: string): void {
  try {
    localStorage.setItem(LAST_PROJECT_KEY, id);
  } catch {
    /* Storage restrictions must not prevent saving the actual project. */
  }
}

/** Older installations have no preference; start with their latest saved project. */
export async function restoreProject(
  api: {
    list(): Promise<ProjectSummary[]>;
    open(id: string): Promise<SavedProject>;
  },
  rememberedId: string | null,
) {
  const projects = await api.list();
  const target =
    projects.find((p) => p.id === rememberedId) ??
    [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const current = target ? await api.open(target.id) : null;
  return { projects, current };
}
