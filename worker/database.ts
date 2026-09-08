/** Minimal D1 contract keeps the Worker independent from the frontend runtime. */
export interface Statement {
  bind(...values: unknown[]): Statement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
}
export interface Database {
  prepare(sql: string): Statement;
}
export interface ProjectRow {
  id: string;
  name: string;
  graph: string;
  revision: number;
  updated_at: string;
}
export function database(env: { DB?: Database }): Database {
  if (!env.DB) throw Error("Project database unavailable");
  return env.DB;
}
