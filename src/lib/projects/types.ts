import type { ERGraph } from "../ast/types";
export interface ProjectSummary {
  id: string;
  name: string;
  revision: number;
  updatedAt: string;
  entityCount: number;
  relationshipCount: number;
}
export interface SavedProject extends ProjectSummary {
  graph: ERGraph;
}
