import { it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { useERStore } from "../src/store/useERStore";
import { attribute } from "../src/store/seed";
import {
  assignWeakOwner,
  canOwnWeakEntity,
} from "../src/lib/ast/weakOwnership";
import { compileGraph } from "../src/lib/compiler/sqlGenerator";
import type { Entity, ERGraph } from "../src/lib/ast/types";
const entity = (id: string): Entity => ({
  id,
  name: id,
  type: "regular",
  color: "#a78bfa",
  position: { x: 0, y: 0 },
  attributes: [attribute(id + "_id", "id", "integer", true)],
});
function model(): ERGraph {
  const owner = entity("owner");
  owner.attributes.push(attribute("tenant", "tenant", "integer", true));
  const weak = entity("line");
  weak.type = "weak";
  weak.attributes = [
    { ...attribute("sequence", "sequence", "integer"), isPartialKey: true },
  ];
  return {
    version: 1,
    name: "Ownership",
    entities: [owner, weak, entity("other")],
    relationships: [],
    specializations: [],
  };
}
it("creates mandatory ownership and an executable composite primary key automatically", async () => {
  const g = model();
  assignWeakOwner(g, "line", "owner");
  const relation = g.relationships[0];
  expect(relation.ownerEntityId).toBe("owner");
  expect(relation.endpoints[0].participation).toEqual({ min: 1, max: 1 });
  expect(relation.endpoints[1].entityParticipation).toBe("total");
  const result = compileGraph(g);
  expect(result.issues.filter((i) => i.severity === "error")).toEqual([]);
  const table = result.schema.tables.find((t) => t.name === "line")!;
  expect(new Set(table.primaryKey)).toEqual(
    new Set(["sequence", "owner_id", "owner_tenant"]),
  );
  expect(table.foreignKeys[0].columns).toHaveLength(2);
  const db = new PGlite();
  try {
    await db.exec(result.sql);
  } finally {
    await db.close();
  }
  expect(g.entities[1].attributes).toHaveLength(1);
});
it("reuses a link, preserves relationship attributes, and changes ownership in one undo step", () => {
  const g = model();
  assignWeakOwner(g, "line", "owner");
  g.relationships[0].type = "non-identifying";
  delete g.relationships[0].ownerEntityId;
  g.relationships[0].attributes.push(attribute("since", "since", "date"));
  const id = g.relationships[0].id;
  assignWeakOwner(g, "line", "owner");
  expect(g.relationships).toHaveLength(1);
  expect(g.relationships[0].id).toBe(id);
  useERStore.setState({
    graph: g,
    past: [],
    future: [],
    transactionBase: null,
  });
  useERStore.getState().setWeakOwner("line", "other");
  const changed = useERStore.getState().graph;
  expect(
    changed.relationships.filter((r) => r.type === "identifying"),
  ).toHaveLength(1);
  expect(
    changed.relationships.find((r) => r.id === id)?.attributes[0].name,
  ).toBe("since");
  useERStore.getState().undo();
  expect(useERStore.getState().graph).toEqual(g);
});
it("prevents ownership cycles and supports nested partial keys", () => {
  const g = model();
  assignWeakOwner(g, "line", "owner");
  expect(canOwnWeakEntity(g, "owner", "line")).toBe(false);
  expect(canOwnWeakEntity(g, "line", "line")).toBe(false);
  assignWeakOwner(g, "owner", "line");
  expect(g.relationships).toHaveLength(1);
  const key = g.entities[1].attributes[0];
  g.entities[1].attributes = [
    { ...attribute("composite", "composite"), compositeChildren: [key] },
  ];
  expect(compileGraph(g).issues.filter((i) => i.severity === "error")).toEqual(
    [],
  );
});
