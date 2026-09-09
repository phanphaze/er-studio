import { beforeEach, it, expect } from "vitest";
import { useERStore } from "../src/store/useERStore";
import { seedGraph, attribute } from "../src/store/seed";
import { attributeRows } from "../src/lib/ast/attributes";
beforeEach(() =>
  useERStore.setState({
    graph: structuredClone(seedGraph),
    past: [],
    future: [],
    selection: null,
    attributeFocus: null,
    transactionBase: null,
  }),
);
it("targets nested fields without changing the graph or clearing redo", () => {
  const s = useERStore.getState();
  s.addAttribute("customers", "c-name");
  const child =
    useERStore.getState().graph.entities[0].attributes[2].compositeChildren![0];
  s.updateEntity("orders", { name: "changed" });
  s.undo();
  const graph = useERStore.getState().graph;
  s.focusAttribute("customers", child.id);
  expect(useERStore.getState().selection).toEqual({
    kind: "entity",
    id: "customers",
  });
  expect(useERStore.getState().attributeFocus?.attributeId).toBe(child.id);
  expect(useERStore.getState().graph).toBe(graph);
  expect(useERStore.getState().future).toHaveLength(1);
  const request = useERStore.getState().attributeFocus!.request;
  s.focusAttribute("customers", child.id);
  expect(useERStore.getState().attributeFocus!.request).toBeGreaterThan(
    request,
  );
});
it("renders nested children in preorder and reorders only their siblings", () => {
  const s = useERStore.getState();
  s.addAttribute("customers", "c-name");
  s.addAttribute("customers", "c-name");
  const attrs = useERStore.getState().graph.entities[0].attributes;
  const [a, b] = attrs[2].compositeChildren!;
  s.reorderAttribute("customers", b.id, 0);
  const rows = attributeRows(
    useERStore.getState().graph.entities[0].attributes,
  );
  expect(
    rows.filter((r) => r.parentId === "c-name").map((r) => r.attribute.id),
  ).toEqual([b.id, a.id]);
  expect(rows.find((r) => r.attribute.id === b.id)?.depth).toBe(1);
  expect(useERStore.getState().graph.entities[0].attributes[2].id).toBe(
    "c-name",
  );
});
it("deleting a composite clears descendant anchors and focus, and undo restores the subtree and anchors", () => {
  const s = useERStore.getState();
  s.commit((g) => {
    g.entities[0].attributes[2].compositeChildren = [
      attribute("child", "street"),
    ];
    g.relationships[0].endpoints[0].attributeId = "child";
  });
  s.focusAttribute("customers", "child");
  s.deleteAttribute("customers", "c-name");
  expect(useERStore.getState().attributeFocus).toBeNull();
  expect(
    useERStore.getState().graph.relationships[0].endpoints[0].attributeId,
  ).toBeUndefined();
  s.undo();
  expect(
    useERStore.getState().graph.relationships[0].endpoints[0].attributeId,
  ).toBe("child");
  expect(
    useERStore.getState().graph.entities[0].attributes[2].compositeChildren![0]
      .id,
  ).toBe("child");
});
