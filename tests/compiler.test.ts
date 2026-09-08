import { describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { compileGraph } from "../src/lib/compiler/sqlGenerator";
import { seedGraph, attribute } from "../src/store/seed";
import type { ERGraph, Entity, Specialization } from "../src/lib/ast/types";
const entity = (id: string): Entity => ({
  id,
  name: id,
  type: "regular",
  color: "#a78bfa",
  position: { x: 0, y: 0 },
  attributes: [attribute(id + "-id", "id", "uuid", true)],
});
const graph = (entities: Entity[]): ERGraph => ({
  version: 1,
  name: "test",
  entities,
  relationships: [],
  specializations: [],
});
async function execute(g: ERGraph) {
  const r = compileGraph(g);
  expect(r.issues.filter((i) => i.severity === "error")).toEqual([]);
  expect(r.sql).toContain("COMMIT");
  const db = new PGlite();
  await db.exec(r.sql);
  await db.close();
  return r;
}
describe("PostgreSQL compilation", () => {
  it("executes seed DDL with junctions, checks and indexes", async () => {
    const r = await execute(seedGraph);
    expect(
      r.schema.tables.find((t) => t.name === "order_items")?.foreignKeys,
    ).toHaveLength(2);
  });
  it("is deterministic across entity and relationship insertion orders", () => {
    const g = structuredClone(seedGraph);
    g.entities.reverse();
    g.relationships.reverse();
    expect(compileGraph(g).sql).toBe(compileGraph(seedGraph).sql);
  });
  it("inherits composite owner keys into weak entities and multivalued child tables", async () => {
    const owner = entity("owner");
    owner.attributes.push(attribute("tenant", "tenant", "integer", true));
    const weak = entity("line");
    weak.type = "weak";
    weak.attributes = [
      { ...attribute("seq", "sequence", "integer"), isPartialKey: true },
      { ...attribute("tags", "tags"), isMultivalued: true },
    ];
    const g = graph([owner, weak]);
    g.relationships = [
      {
        id: "owns",
        name: "owns",
        type: "identifying",
        cardinality: "1:N",
        ownerEntityId: "owner",
        endpoints: [
          {
            entityId: "owner",
            role: "owner",
            participation: { min: 1, max: 1 },
          },
          {
            entityId: "line",
            role: "line",
            participation: { min: 0, max: "*" },
          },
        ],
        attributes: [],
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
    ];
    const r = await execute(g);
    expect(r.schema.tables.find((t) => t.name === "line")?.primaryKey).toEqual([
      "sequence",
      "owner_id",
      "owner_tenant",
    ]);
    expect(
      r.schema.tables.find((t) => t.name === "line_tags")?.primaryKey,
    ).toHaveLength(4);
  });
  it.each(["table-per-type", "table-per-hierarchy"] as const)(
    "executes %s inheritance",
    async (strategy) => {
      const parent = entity("person"),
        child = entity("student");
      child.attributes.push(attribute("grade", "grade", "integer"));
      const g = graph([parent, child]);
      g.specializations = [
        {
          id: "isa",
          name: "person_types",
          superclassId: parent.id,
          subclassIds: [child.id],
          disjointness: "disjoint",
          completeness: "total",
          strategy,
          position: { x: 0, y: 0 },
        },
      ];
      await execute(g);
    },
  );
  it("executes recursive relationships with role-specific keys", async () => {
    const g = graph([entity("person")]);
    g.relationships = [
      {
        id: "r",
        name: "mentors",
        type: "recursive",
        cardinality: "1:N",
        endpoints: [
          {
            entityId: "person",
            role: "mentor",
            participation: { min: 0, max: 1 },
          },
          {
            entityId: "person",
            role: "mentee",
            participation: { min: 0, max: "*" },
          },
        ],
        attributes: [],
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
    ];
    await execute(g);
  });
  it("rejects SET NULL on non-nullable references", () => {
    const g = structuredClone(seedGraph);
    g.relationships[0].onDelete = "SET NULL";
    expect(compileGraph(g).sql).toBe("");
  });
  it("rejects keyless, colliding and dangling models", () => {
    const g = graph([entity("a")]);
    g.entities[0].attributes = [];
    expect(compileGraph(g).issues[0].code).toBe("PRIMARY_KEY");
    const duplicate = structuredClone(seedGraph);
    duplicate.entities[0].name = duplicate.entities[1].name;
    expect(compileGraph(duplicate).sql).toBe("");
  });
  it("quotes hostile identifiers without executing injected SQL", async () => {
    const e = entity("safe");
    e.name = 'odd"; DROP TABLE x; --';
    e.attributes[0].name = 'a"b';
    await execute(graph([e]));
  });
  it("rejects inheritance cycles", () => {
    const a = entity("a"),
      b = entity("b");
    const g = graph([a, b]);
    const s: Specialization = {
      id: "s",
      name: "s",
      superclassId: "a",
      subclassIds: ["b"],
      strategy: "table-per-type",
      completeness: "partial",
      disjointness: "overlapping",
      position: { x: 0, y: 0 },
    };
    g.specializations = [
      s,
      { ...s, id: "t", superclassId: "b", subclassIds: ["a"] },
    ];
    expect(compileGraph(g).sql).toBe("");
  });
  it("enforces CHECK and unique constraints in PostgreSQL", async () => {
    const e = entity("inventory");
    e.attributes[0].type = "integer";
    e.attributes.push({
      ...attribute("amount", "amount", "integer"),
      check: { operator: ">=", value: 0 },
      isUnique: true,
    });
    const r = compileGraph(graph([e]));
    const db = new PGlite();
    await db.exec(r.sql);
    await expect(
      db.exec("INSERT INTO inventory VALUES (1,-1)"),
    ).rejects.toThrow();
    await db.exec("INSERT INTO inventory VALUES (1,2)");
    await expect(
      db.exec("INSERT INTO inventory VALUES (2,2)"),
    ).rejects.toThrow();
    await db.close();
  });
});
