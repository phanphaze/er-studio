import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import worker from "../worker/index";
import type { Database, Statement } from "../worker/database";
import { seedGraph } from "../src/store/seed";
import type { SavedProject } from "../src/lib/projects/types";
let sqlite: DatabaseSync;
let db: Database;
beforeEach(() => {
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync("drizzle/0000_old_umar.sql", "utf8"));
  db = {
    prepare(sql) {
      let args: unknown[] = [];
      const s: Statement = {
        bind(...values) {
          args = values;
          return s;
        },
        async first<T>() {
          return (sqlite.prepare(sql).get(...(args as (string | number)[])) ??
            null) as T | null;
        },
        async all<T>() {
          return {
            results: sqlite
              .prepare(sql)
              .all(...(args as (string | number)[])) as T[],
          };
        },
        async run() {
          const r = sqlite.prepare(sql).run(...(args as (string | number)[]));
          return { meta: { changes: Number(r.changes) } };
        },
      };
      return s;
    },
  };
});
afterEach(() => sqlite.close());
const call = (
  path: string,
  method = "GET",
  body?: unknown,
  headers: Record<string, string> = {},
) =>
  worker.fetch(
    new Request("https://example.test" + path, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    { DB: db, ASSETS: { fetch: async () => new Response("asset") } },
  );
describe("durable project API", () => {
  it("creates, lists, saves and reopens a project using the actual migration", async () => {
    const created = await call("/api/projects", "POST", { graph: seedGraph });
    expect(created.status).toBe(201);
    const project = (await created.json()) as SavedProject;
    const list = await (await call("/api/projects")).json();
    expect(list).toHaveLength(1);
    expect(list[0].entityCount).toBe(4);
    expect(list[0].graph).toBeUndefined();
    const changed = { ...seedGraph, name: "Renamed project" };
    const saved = await call("/api/projects/" + project.id, "PUT", {
      graph: changed,
      revision: 1,
    });
    expect(saved.status).toBe(200);
    const reopened = (await (
      await call("/api/projects/" + project.id)
    ).json()) as SavedProject;
    expect(reopened.name).toBe("Renamed project");
    expect(reopened.graph).toEqual(changed);
    expect(reopened.revision).toBe(2);
  });
  it("rejects stale writes without overwriting a saved model", async () => {
    const project = (await (
      await call("/api/projects", "POST", { graph: seedGraph })
    ).json()) as SavedProject;
    await call("/api/projects/" + project.id, "PUT", {
      graph: { ...seedGraph, name: "First writer" },
      revision: 1,
    });
    const conflict = await call("/api/projects/" + project.id, "PUT", {
      graph: { ...seedGraph, name: "Stale writer" },
      revision: 1,
    });
    expect(conflict.status).toBe(409);
    expect(
      (await (await call("/api/projects/" + project.id)).json()).name,
    ).toBe("First writer");
  });
  it("rejects invalid imports and cross-origin writes", async () => {
    expect(
      (await call("/api/projects", "POST", { graph: { version: 2 } })).status,
    ).toBe(400);
    expect(
      (
        await call(
          "/api/projects",
          "POST",
          { graph: seedGraph },
          { origin: "https://other.test" },
        )
      ).status,
    ).toBe(403);
    expect(await (await call("/api/projects")).json()).toEqual([]);
  });
  it("keeps separate saved projects and returns 404 for missing ids", async () => {
    await call("/api/projects", "POST", { graph: seedGraph });
    await call("/api/projects", "POST", {
      graph: { ...seedGraph, name: "Second project" },
    });
    expect(await (await call("/api/projects")).json()).toHaveLength(2);
    expect((await call("/api/projects/missing")).status).toBe(404);
  });
  it("returns recoverable failures and delegates non-API assets", async () => {
    expect(await (await call("/")).text()).toBe("asset");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await worker.fetch(
      new Request("https://example.test/api/projects"),
      {
        DB: undefined as unknown as Database,
        ASSETS: { fetch: async () => new Response() },
      },
    );
    expect(result.status).toBe(503);
    spy.mockRestore();
  });
});
