import { it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { compileGraph } from "../src/lib/compiler/sqlGenerator";
import { parseModel } from "../src/lib/ast/serialization";
import { seedGraph, attribute } from "../src/store/seed";
import { useERStore } from "../src/store/useERStore";
it("enforces digit and exact/max character lengths while preserving leading zeros, and supports time", async () => {
  const g = structuredClone(seedGraph);
  g.entities = [
    {
      ...g.entities[0],
      name: "contacts",
      attributes: [
        attribute("key", "id", "integer", true),
        {
          ...attribute("card", "card_reference"),
          minLength: 16,
          maxLength: 16,
          digitsOnly: true,
        },
        { ...attribute("phone", "phone"), maxLength: 10, digitsOnly: true },
        attribute("time", "contact_time", "time"),
      ],
    },
  ];
  g.relationships = [];
  const r = compileGraph(g);
  expect(r.issues.filter((i) => i.severity === "error")).toEqual([]);
  const db = new PGlite();
  await db.exec(r.sql);
  await db.exec(
    "INSERT INTO contacts VALUES (1,'0123456789012345','0123456789','09:30:00')",
  );
  expect(
    (await db.query<{ phone: string }>("SELECT phone FROM contacts")).rows[0]
      .phone,
  ).toBe("0123456789");
  await expect(
    db.exec("INSERT INTO contacts VALUES (2,'123','123','10:00')"),
  ).rejects.toThrow();
  await expect(
    db.exec(
      "INSERT INTO contacts VALUES (2,'0123456789012345','12345678901','10:00')",
    ),
  ).rejects.toThrow();
  await expect(
    db.exec(
      "INSERT INTO contacts VALUES (2,'0123456789012345','123ABC','10:00')",
    ),
  ).rejects.toThrow();
  await db.close();
  expect(parseModel(JSON.stringify(g))).toEqual(g);
});
it("preserves FK overrides in files and compiles valid renamed constraints", async () => {
  const g = structuredClone(seedGraph);
  const before = compileGraph(g);
  const col = before.schema.tables
    .find((t) => t.name === "orders")!
    .columns.find((c) => c.sourceRelationshipId === "places")!;
  g.relationships[0].foreignKeyNames = {
    [col.generatedName!]: "customer_email_reference",
  };
  const roundtrip = parseModel(JSON.stringify(g));
  const r = compileGraph(roundtrip);
  const table = r.schema.tables.find((t) => t.name === "orders")!;
  expect(table.foreignKeys[0].columns).toContain("customer_email_reference");
  expect(table.columns.some((c) => c.name === "customer_email_reference")).toBe(
    true,
  );
  const db = new PGlite();
  await db.exec(r.sql);
  await db.close();
});
it("rejects inverted limits and digit checks on numeric types", () => {
  const g = structuredClone(seedGraph);
  g.entities[0].attributes[1].minLength = 20;
  g.entities[0].attributes[1].maxLength = 10;
  expect(compileGraph(g).sql).toBe("");
  g.entities[0].attributes[1].minLength = undefined;
  g.entities[0].attributes[1].type = "integer";
  expect(compileGraph(g).sql).toBe("");
});
it("creates an undoable address preset with editable children and optional fields", () => {
  useERStore.setState({
    graph: structuredClone(seedGraph),
    past: [],
    future: [],
    selection: null,
    attributeFocus: null,
    transactionBase: null,
  });
  useERStore.getState().addAddress("customers");
  const a = useERStore.getState().graph.entities[0].attributes.at(-1)!;
  expect(a.preset).toBe("address");
  expect(a.compositeChildren?.map((c) => c.name)).toEqual([
    "street",
    "address_line_2",
    "city",
    "state",
    "postal_code",
    "country",
  ]);
  expect(a.compositeChildren?.find((c) => c.name === "state")?.isNullable).toBe(
    true,
  );
  expect(compileGraph(useERStore.getState().graph).sql).toContain(
    "address_street",
  );
  useERStore.getState().undo();
  expect(useERStore.getState().graph).toEqual(seedGraph);
});
