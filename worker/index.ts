import type { ProjectSummary } from "../src/lib/projects/types";
import { parseModel } from "../src/lib/ast/serialization";
import { database, type Database, type ProjectRow } from "./database";
interface Env {
  DB: Database;
  ASSETS: { fetch(request: Request): Promise<Response> };
}
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const summary = (r: ProjectRow) => {
  const graph = parseModel(r.graph);
  return {
    id: r.id,
    name: r.name,
    revision: r.revision,
    updatedAt: r.updated_at,
    entityCount: graph.entities.length,
    relationshipCount: graph.relationships.length,
  };
};
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    try {
      if (!url.pathname.match(/^\/api\/projects(?:\/[a-zA-Z0-9-]+)?$/))
        return json({ error: "Not found" }, 404);
      const db = database(env);
      const id = url.pathname.split("/")[3];
      if (request.method === "GET") {
        if (id) {
          const row = await db
            .prepare("SELECT * FROM projects WHERE id = ?")
            .bind(id)
            .first<ProjectRow>();
          return row
            ? json({ ...summary(row), graph: parseModel(row.graph) })
            : json({ error: "Project not found" }, 404);
        }
        const rows = await db
          .prepare(
            "SELECT id, name, revision, updated_at AS updatedAt, json_array_length(graph, '$.entities') AS entityCount, json_array_length(graph, '$.relationships') AS relationshipCount FROM projects ORDER BY updated_at DESC",
          )
          .all<ProjectSummary>();
        return json(rows.results);
      }
      if (!["POST", "PUT"].includes(request.method))
        return json({ error: "Method not allowed" }, 405);
      const origin = request.headers.get("origin");
      if (origin && origin !== url.origin)
        return json({ error: "Cross-origin changes are not allowed" }, 403);
      if (!request.headers.get("content-type")?.includes("application/json"))
        return json({ error: "JSON required" }, 415);
      if (Number(request.headers.get("content-length")) > 5_100_000)
        return json({ error: "Model exceeds 5 MB" }, 413);
      const text = await request.text();
      if (text.length > 5_100_000)
        return json({ error: "Model exceeds 5 MB" }, 413);
      let body: { graph?: unknown; revision?: unknown };
      let graph;
      try {
        body = JSON.parse(text);
        graph = parseModel(JSON.stringify(body.graph));
      } catch {
        return json({ error: "Invalid ER model" }, 400);
      }
      if (!graph.name.trim())
        return json({ error: "Project name is required" }, 400);
      const updatedAt = new Date().toISOString();
      const serialized = JSON.stringify(graph);
      if (request.method === "POST" && !id) {
        const projectId = crypto.randomUUID();
        await db
          .prepare(
            "INSERT INTO projects (id,name,graph,revision,updated_at) VALUES (?,?,?,1,?)",
          )
          .bind(projectId, graph.name, serialized, updatedAt)
          .run();
        return json(
          {
            id: projectId,
            name: graph.name,
            graph,
            revision: 1,
            updatedAt,
            entityCount: graph.entities.length,
            relationshipCount: graph.relationships.length,
          },
          201,
        );
      }
      if (request.method === "PUT" && id) {
        if (!Number.isInteger(body.revision))
          return json({ error: "Revision required" }, 400);
        const result = await db
          .prepare(
            "UPDATE projects SET name = ?, graph = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ?",
          )
          .bind(graph.name, serialized, updatedAt, id, body.revision)
          .run();
        if (!result.meta.changes)
          return json(
            {
              error:
                "This project changed in another tab. Open the latest version or save your changes as a new project.",
            },
            409,
          );
        return json({
          id,
          name: graph.name,
          graph,
          revision: Number(body.revision) + 1,
          updatedAt,
          entityCount: graph.entities.length,
          relationshipCount: graph.relationships.length,
        });
      }
      return json({ error: "Not found" }, 404);
    } catch (error) {
      console.error(
        "Project API failed",
        error instanceof Error ? error.message : "Unknown error",
      );
      return json(
        {
          error:
            "Project storage is temporarily unavailable. Your current diagram has not been changed. Please retry.",
        },
        503,
      );
    }
  },
};
