import { expect, it } from "vitest";
import {
  buildRelationalReport,
  relationalReportHtml,
} from "../src/lib/compiler/relationalReport";
import { compileGraph } from "../src/lib/compiler/sqlGenerator";
import { attribute } from "../src/store/seed";
import { assignWeakOwner } from "../src/lib/ast/weakOwnership";
import type { ERGraph, Entity } from "../src/lib/ast/types";
const entity = (id: string): Entity => ({
  id,
  name: id,
  type: "regular",
  color: "#a78bfa",
  position: { x: 0, y: 0 },
  attributes: [attribute(id + "_pk", "id", "integer", true)],
});
it("captures ordered, independent cumulative stages and matches final compiled tables", () => {
  const owner = entity("customer"),
    weak = entity("address"),
    other = entity("product");
  owner.attributes.push({
    ...attribute("name", "name"),
    compositeChildren: [attribute("first", "first"), attribute("last", "last")],
  });
  owner.attributes.push({
    ...attribute("phones", "phones"),
    isMultivalued: true,
  });
  weak.type = "weak";
  weak.attributes = [
    { ...attribute("sequence", "sequence", "integer"), isPartialKey: true },
  ];
  const graph: ERGraph = {
    version: 1,
    name: "<img src=x onerror=alert(1)>",
    entities: [owner, weak, other],
    relationships: [],
    specializations: [],
  };
  assignWeakOwner(graph, "address", "customer");
  graph.relationships.push({
    id: "purchases",
    name: "purchases",
    type: "non-identifying",
    cardinality: "M:N",
    endpoints: [
      {
        entityId: "customer",
        role: "customer",
        participation: { min: 0, max: "*" },
      },
      {
        entityId: "product",
        role: "product",
        participation: { min: 0, max: "*" },
      },
    ],
    attributes: [],
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });
  const report = buildRelationalReport(graph);
  expect(report.issues.filter((i) => i.severity === "error")).toEqual([]);
  expect(report.steps.map((s) => s.number)).toEqual([1, 2, 3, 4, 5]);
  const [strong, weakStep, multivalued, relations, final] = report.steps;
  expect(strong.tables.map((t) => t.name)).toEqual(["customer", "product"]);
  expect(strong.tables[0].columns.map((c) => c.name)).toEqual([
    "id",
    "name_first",
    "name_last",
  ]);
  expect(weakStep.tables.find((t) => t.name === "address")?.primaryKey).toEqual(
    ["sequence", "customer_id"],
  );
  expect(weakStep.tables.some((t) => t.name === "customer_phones")).toBe(false);
  expect(
    multivalued.tables.find((t) => t.name === "customer_phones")?.primaryKey,
  ).toEqual(["customer_id", "phones"]);
  expect(multivalued.tables.some((t) => t.name === "purchases")).toBe(false);
  expect(
    relations.tables.find((t) => t.name === "purchases")?.foreignKeys,
  ).toHaveLength(2);
  expect(final.tables).toEqual(compileGraph(graph).schema.tables);
  expect(strong.tables[0].foreignKeys).toEqual([]);
  const html = relationalReportHtml(graph.name, report);
  expect(html).toContain("&lt;img");
  expect(html).not.toContain("<img");
  expect(html).toContain("<b>FK:</b> (customer_id)");
});
