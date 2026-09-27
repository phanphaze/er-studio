import { it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { useERStore } from "../src/store/useERStore";
import { attribute } from "../src/store/seed";
import { compileGraph } from "../src/lib/compiler/sqlGenerator";
import { parseModel } from "../src/lib/ast/serialization";
import type { ERGraph } from "../src/lib/ast/types";
it("supports several cards per customer while preserving one customer per card, with undo and SQL enforcement", async () => {
  const g: ERGraph = {
    version: 1,
    name: "cards",
    specializations: [],
    entities: ["customer", "credit_card"].map((id) => ({
      id,
      name: id,
      type: "regular",
      position: { x: 0, y: 0 },
      color: "#888888",
      attributes: [attribute(id + "_id", "id", "integer", true)],
    })),
    relationships: [
      {
        id: "owns",
        name: "owns",
        type: "non-identifying",
        cardinality: "1:1",
        endpoints: [
          {
            entityId: "customer",
            role: "customer",
            participation: { min: 1, max: 1 },
          },
          {
            entityId: "credit_card",
            role: "card",
            participation: { min: 0, max: 1 },
          },
        ],
        attributes: [],
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      },
    ],
  };
  useERStore.setState({
    graph: g,
    past: [],
    future: [],
    transactionBase: null,
    selectedIds: [],
  });
  useERStore.getState().setEntityMultiplicity("owns", 1, true);
  const many = useERStore.getState().graph;
  expect(many.relationships[0].cardinality).toBe("1:N");
  expect(many.relationships[0].endpoints[0].participation.max).toBe(1);
  expect(parseModel(JSON.stringify(many))).toEqual(many);
  const compiled = compileGraph(many);
  expect(compiled.issues.filter((i) => i.severity === "error")).toEqual([]);
  const table = compiled.schema.tables.find((t) => t.name === "credit_card")!,
    fk = table.foreignKeys[0].columns[0];
  const db = new PGlite();
  await db.exec(compiled.sql);
  await db.exec(
    `INSERT INTO customer(id) VALUES(1);INSERT INTO credit_card(id,"${fk}") VALUES(10,1),(11,1),(12,1);`,
  );
  expect((await db.query("SELECT * FROM credit_card")).rows).toHaveLength(3);
  await db.close();
  useERStore.getState().undo();
  expect(useERStore.getState().graph).toEqual(g);
  useERStore.getState().redo();
  useERStore.getState().setEntityMultiplicity("owns", 1, false);
  expect(useERStore.getState().graph.relationships[0].cardinality).toBe("1:1");
});
