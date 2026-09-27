import { it, expect } from "vitest";
import { seedGraph, attribute } from "../src/store/seed";
import { useERStore } from "../src/store/useERStore";
import { attributeRows } from "../src/lib/ast/attributes";
import { parseModel } from "../src/lib/ast/serialization";
import { projectGraph } from "../src/lib/layout/projection";
import { organize } from "../src/lib/layout/organize";
import { overlap } from "../src/lib/layout/geometry";
import { LABEL_WIDTH, LABEL_HEIGHT } from "../src/lib/layout/labels";
it("nests and unnests whole attribute subtrees with IDs and undo preserved", () => {
  const g = structuredClone(seedGraph),
    e = g.entities[0];
  e.attributes.push(attribute("parent", "contact"), {
    ...attribute("child", "address"),
    compositeChildren: [attribute("leaf", "street")],
  });
  useERStore.setState({
    graph: g,
    past: [],
    future: [],
    transactionBase: null,
    selectedIds: [],
  });
  useERStore.getState().changeAttributeDepth(e.id, "child", "indent");
  expect(
    attributeRows(useERStore.getState().graph.entities[0].attributes).find(
      (r) => r.attribute.id === "leaf",
    )?.depth,
  ).toBe(2);
  const nested = useERStore.getState().graph;
  expect(parseModel(JSON.stringify(nested))).toEqual(nested);
  useERStore.getState().changeAttributeDepth(e.id, "child", "outdent");
  expect(
    attributeRows(useERStore.getState().graph.entities[0].attributes).find(
      (r) => r.attribute.id === "child",
    )?.depth,
  ).toBe(0);
  useERStore.getState().undo();
  expect(useERStore.getState().graph).toEqual(nested);
  useERStore.getState().undo();
  expect(useERStore.getState().graph).toEqual(g);
});
it("adds and focuses a new child and rejects invalid first-row nesting", () => {
  useERStore.setState({
    graph: structuredClone(seedGraph),
    past: [],
    future: [],
    transactionBase: null,
    selectedIds: [],
  });
  const id = seedGraph.entities[0].id;
  const first = seedGraph.entities[0].attributes[0].id;
  useERStore.getState().changeAttributeDepth(id, first, "indent");
  expect(useERStore.getState().past).toHaveLength(0);
  useERStore.getState().addAttribute(id, first);
  expect(useERStore.getState().attributeFocus?.ownerId).toBe(id);
  expect(
    useERStore.getState().graph.entities[0].attributes[0].compositeChildren?.[0]
      .id,
  ).toBe(useERStore.getState().attributeFocus?.attributeId);
});
it("renders every relationship as a diamond node and keeps organized labels clear of nodes and other labels", async () => {
  const g = structuredClone(seedGraph);
  for (const notation of ["chen", "crows-foot", "uml"] as const) {
    let p = projectGraph(g, notation, null);
    expect(p.nodes.filter((n) => n.type === "relationship")).toHaveLength(
      g.relationships.length,
    );
    g.layouts ??= {};
    g.layouts[notation] = await organize(p.nodes, p.edges);
    p = projectGraph(g, notation, null);
    const nodes = p.nodes
      .filter((n) => n.type !== "entitySet")
      .map((n) => ({
        id: n.id,
        ...n.position,
        width: n.width!,
        height: n.height!,
      }));
    const labels = p.edges.flatMap((e) =>
      e.data?.labelPosition
        ? [
            {
              id: e.id,
              x: e.data.labelPosition.x - LABEL_WIDTH / 2,
              y: e.data.labelPosition.y - LABEL_HEIGHT / 2,
              width: LABEL_WIDTH,
              height: LABEL_HEIGHT,
            },
          ]
        : [],
    );
    for (const label of labels) {
      for (const n of nodes) expect(overlap(label, n, 0)).toBe(false);
      for (const other of labels)
        if (other.id !== label.id) expect(overlap(label, other, 0)).toBe(false);
    }
  }
});
