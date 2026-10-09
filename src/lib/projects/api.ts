import type { ERGraph } from "../ast/types";
import type { ProjectSummary, SavedProject } from "./types";
async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch("/api/projects" + path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw Error(
      "Project storage is unavailable. Continue to the editor to import or export a JSON backup.",
    );
  }
  if (!response.ok) throw Error(result.error ?? "Project request failed");
  return result as T;
}
export const projectsAPI = {
  list: () => call<ProjectSummary[]>(""),
  open: (id: string) => call<SavedProject>("/" + encodeURIComponent(id)),
  save: (graph: ERGraph, current: { id: string; revision: number } | null) =>
    call<SavedProject>(current ? "/" + encodeURIComponent(current.id) : "", {
      method: current ? "PUT" : "POST",
      body: JSON.stringify({ graph, revision: current?.revision }),
    }),
};
