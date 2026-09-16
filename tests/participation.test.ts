import { it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { attribute, seedGraph } from "../src/store/seed";
import { compileGraph } from "../src/lib/compiler/sqlGenerator";
import { relationshipCardinality } from "../src/lib/ast/participation";
import { projectGraph } from "../src/lib/layout/projection";
import { useERStore } from "../src/store/useERStore";
import { parseModel } from "../src/lib/ast/serialization";
import type { ERGraph } from "../src/lib/ast/types";
function bounded(ternary: boolean): ERGraph {
  const names = ternary ? ["a", "b", "c"] : ["a", "b"];
  return {
    version: 1,
    name: "bounds",
    specializations: [],
    entities: names.map((id) => ({
      id,
      name: id,
      type: "regular",
      color: "#888888",
      position: { x: 0, y: 0 },
      attributes: [attribute(id + "id", "id", "integer", true)],
    })),
    relationships: [
      {
        id: "r",
        name: "assignment",
        type: ternary ? "n-ary" : "non-identifying",
        cardinality: "M:N",
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
        attributes: [],
        endpoints: names.map((entityId, i) => ({
          entityId,
          role: entityId,
          participation: { min: 0, max: i === 0 ? 2 : i === 1 ? 3 : 1 },
          entityParticipation: i === 0 ? "total" : "partial",
        })),
      },
    ],
  };
}
it("enforces independent n:m upper bounds, reuses released capacity, and handles updates", async () => {
  const r = compileGraph(bounded(false));
  expect(r.sql).not.toBe("");
  const db = new PGlite();
  await db.exec(r.sql);
  await db.exec(
    "INSERT INTO a VALUES (1),(2),(3),(4); INSERT INTO b VALUES (1),(2),(3),(4);",
  );
  await db.exec(
    "INSERT INTO assignment (a_id,b_id) VALUES (1,1),(2,1),(1,2),(1,3);",
  );
  await expect(
    db.exec("INSERT INTO assignment (a_id,b_id) VALUES (3,1)"),
  ).rejects.toThrow("maximum");
  await expect(
    db.exec("INSERT INTO assignment (a_id,b_id) VALUES (1,4)"),
  ).rejects.toThrow("maximum");
  await db.exec(
    "DELETE FROM assignment WHERE a_id=2 AND b_id=1; INSERT INTO assignment (a_id,b_id) VALUES (3,1);",
  );
  await expect(
    db.exec("UPDATE assignment SET a_id=1,b_id=4 WHERE a_id=3"),
  ).rejects.toThrow("maximum");
  await db.close();
});
it("enforces ternary upper bounds for the fixed pair of other roles and max-one uniqueness", async () => {
  const g = bounded(true);
  const r = compileGraph(g);
  expect(r.issues.filter((i) => i.severity === "error")).toEqual([]);
  const db = new PGlite();
  await db.exec(r.sql);
  await db.exec(
    "INSERT INTO a VALUES (1),(2),(3); INSERT INTO b VALUES (1),(2); INSERT INTO c VALUES (1),(2); INSERT INTO assignment(a_id,b_id,c_id) VALUES (1,1,1),(2,1,1);",
  );
  await expect(
    db.exec("INSERT INTO assignment(a_id,b_id,c_id) VALUES (3,1,1)"),
  ).rejects.toThrow("maximum");
  await db.exec("INSERT INTO assignment(a_id,b_id,c_id) VALUES (3,1,2);");
  await expect(
    db.exec("INSERT INTO assignment(a_id,b_id,c_id) VALUES (1,1,2)"),
  ).rejects.toThrow();
  const loaded = parseModel(JSON.stringify(g));
  const p = projectGraph(loaded, "chen", null);
  expect(p.edges.find((e) => e.id === "r-0")?.data?.mandatory).toBe(true);
  expect(p.edges.find((e) => e.id === "r-1")?.data?.mandatory).toBe(false);
  expect(p.edges.find((e) => e.id === "r-0")?.data?.label).toContain(
    "Per b + c:",
  );
  await db.close();
});
it("inversion changes the directional label, bounds, and undo restores them", () => {
  useERStore.setState({
    graph: structuredClone(seedGraph),
    past: [],
    future: [],
    transactionBase: null,
  });
  const r = useERStore.getState().graph.relationships[0];
  const before = relationshipCardinality(r.endpoints);
  useERStore.getState().invertCardinality(r.id);
  expect(
    relationshipCardinality(
      useERStore.getState().graph.relationships[0].endpoints,
    ),
  ).not.toBe(before);
  useERStore.getState().undo();
  expect(
    relationshipCardinality(
      useERStore.getState().graph.relationships[0].endpoints,
    ),
  ).toBe(before);
});

it("quotes bounded relationship names safely and enforces a finite one-to-many bound", async () => {
  const g = bounded(false);
  g.relationships[0].name = "odd$er_bound$name";
  g.relationships[0].endpoints[0].participation = { min: 0, max: 1 };
  g.relationships[0].endpoints[1].participation = { min: 0, max: 2 };
  g.relationships[0].cardinality = "1:N";
  const r = compileGraph(g);
  expect(r.sql).not.toBe("");
  const db = new PGlite();
  await db.exec(r.sql);
  const fk = r.schema.tables.find((t) => t.name === "b")!.foreignKeys[0]
    .columns[0];
  const col = '"' + fk.replaceAll('"', '""') + '"';
  await db.exec("INSERT INTO a VALUES (1),(2);");
  await db.exec(`INSERT INTO b(id,${col}) VALUES (1,1),(2,1);`);
  await expect(
    db.exec(`INSERT INTO b(id,${col}) VALUES (3,1);`),
  ).rejects.toThrow("maximum");
  await db.exec(
    `UPDATE b SET ${col}=2 WHERE id=2; INSERT INTO b(id,${col}) VALUES (3,1);`,
  );
  await db.close();
});
