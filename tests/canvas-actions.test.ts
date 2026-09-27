import { it, expect } from "vitest";
import { useERStore } from "../src/store/useERStore";
import { seedGraph } from "../src/store/seed";
import { projectGraph } from "../src/lib/layout/projection";
import { expandItems } from "../src/lib/ast/entitySets";
import { parseModel } from "../src/lib/ast/serialization";
import { route, facing } from "../src/lib/layout/geometry";
function reset() {
  useERStore.setState({
    graph: structuredClone(seedGraph),
    past: [],
    future: [],
    selectedIds: [],
    selection: null,
    transactionBase: null,
    notation: "chen",
  });
}
it("spawns at viewport insertion point, honoring explicit positions and saved Chen positions", () => {
  reset();
  useERStore.setState({ insertionPosition: () => ({ x: 712, y: -160 }) });
  const id = useERStore.getState().addEntity("new");
  const p = projectGraph(useERStore.getState().graph, "chen", null);
  expect(p.nodes.find((n) => n.id === id)?.position).toEqual({
    x: 712,
    y: -160,
  });
  const other = useERStore.getState().addEntity("explicit", { x: 20, y: 40 });
  expect(
    useERStore.getState().graph.entities.find((e) => e.id === other)?.position,
  ).toEqual({ x: 20, y: 40 });
  useERStore.setState({ insertionPosition: undefined });
});
it("aggregates, persists and deletes a set atomically, preserving unrelated entities and restoring with undo", () => {
  reset();
  const r = seedGraph.relationships[0];
  useERStore.getState().aggregateRelationship(r.id);
  const g = useERStore.getState().graph,
    set = g.entitySets![0];
  expect(parseModel(JSON.stringify(g)).entitySets).toEqual(g.entitySets);
  expect(
    projectGraph(g, "chen", null).nodes.find((n) => n.id === set.id)?.type,
  ).toBe("entitySet");
  expect(expandItems(g, [set.id])).toContain(r.endpoints[0].entityId);
  useERStore.setState({ selectedIds: [set.id] });
  useERStore.getState().deleteSelected();
  expect(
    useERStore
      .getState()
      .graph.entities.some((e) => e.id === r.endpoints[0].entityId),
  ).toBe(false);
  expect(useERStore.getState().graph.entities.length).toBe(
    seedGraph.entities.length -
      new Set(r.endpoints.map((p) => p.entityId)).size,
  );
  useERStore.getState().undo();
  expect(useERStore.getState().graph).toEqual(g);
});
it("uses Crow’s Foot renderer for relationship hubs and UML data for UML", () => {
  const c = projectGraph(seedGraph, "crows-foot", null),
    u = projectGraph(seedGraph, "uml", null);
  expect(
    c.edges
      .filter((e) => e.data?.relationshipId)
      .every((e) => e.type === "crow" && !e.data?.uml),
  ).toBe(true);
  expect(
    u.edges.filter((e) => e.data?.relationshipId).every((e) => e.data?.uml),
  ).toBe(true);
});
it("routes clear aligned nodes straight and clear diagonal nodes with one bend", () => {
  const a = { id: "a", x: 0, y: 0, width: 100, height: 100 },
    b = { id: "b", x: 300, y: 0, width: 100, height: 100 };
  expect(
    route({ x: 100, y: 50 }, { x: 300, y: 50 }, "right", "left", [a, b]),
  ).toHaveLength(2);
  b.y = 250;
  expect(facing(a, b)).toEqual(["right", "top"]);
  expect(
    route({ x: 100, y: 50 }, { x: 350, y: 250 }, "right", "top", [a, b]),
  ).toHaveLength(3);
});

it("adds entities and attributes to a shared selection and deletes attributes without deleting their owner", () => {
  reset();
  const s = useERStore.getState();
  const entity = s.graph.entities[0];
  const other = s.graph.entities[1];
  const first = entity.attributes[0],
    second = entity.attributes[1];
  s.setSelection({ kind: "entity", id: other.id });
  s.focusAttribute(entity.id, first.id, true);
  s.focusAttribute(entity.id, second.id, true);
  expect(useERStore.getState().selectedIds).toEqual([
    other.id,
    first.id,
    second.id,
  ]);
  s.setSelection({ kind: "entity", id: entity.id }, true);
  expect(useERStore.getState().selectedIds).toContain(first.id);
  s.focusAttribute(entity.id, first.id);
  s.focusAttribute(entity.id, second.id, true);
  expect(useERStore.getState().selectedIds).toEqual([first.id, second.id]);
  s.deleteSelected();
  const remaining = useERStore
    .getState()
    .graph.entities.find((e) => e.id === entity.id);
  expect(remaining).toBeDefined();
  expect(
    remaining?.attributes.some((a) => [first.id, second.id].includes(a.id)),
  ).toBe(false);
  s.undo();
  expect(
    useERStore.getState().graph.entities.find((e) => e.id === entity.id)
      ?.attributes,
  ).toEqual(entity.attributes);
});

it("makes Chen attributes selectable and carries their owner colors into the overview node data", () => {
  const graph = structuredClone(seedGraph);
  graph.entities[0].color = "#123456";
  const projection = projectGraph(graph, "chen", null);
  for (const attribute of graph.entities[0].attributes) {
    const node = projection.nodes.find((n) => n.id === attribute.id);
    expect(node?.selectable).toBe(true);
    expect(node?.data.ownerColor).toBe("#123456");
  }
});
