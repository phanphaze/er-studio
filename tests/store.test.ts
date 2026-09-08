import { beforeEach, describe, it, expect } from "vitest";
import { useERStore } from "../src/store/useERStore";
import { seedGraph } from "../src/store/seed";
beforeEach(() =>
  useERStore.setState({
    graph: structuredClone(seedGraph),
    past: [],
    future: [],
    selection: null,
    transactionBase: null,
  }),
);
describe("transactional model history", () => {
  it("groups an entire drag into one undo and restores it through redo", () => {
    const s = useERStore.getState();
    const initial = s.graph.entities[0].position;
    s.beginTransaction();
    s.moveEntities([{ id: "customers", position: { x: 1, y: 1 } }]);
    s.moveEntities([{ id: "customers", position: { x: 20, y: 20 } }]);
    s.endTransaction();
    expect(useERStore.getState().past).toHaveLength(1);
    s.undo();
    expect(useERStore.getState().graph.entities[0].position).toEqual(initial);
    s.redo();
    expect(useERStore.getState().graph.entities[0].position).toEqual({
      x: 20,
      y: 20,
    });
  });
  it("preserves redo during selections and clears it on new mutations", () => {
    const s = useERStore.getState();
    s.addAttribute("customers");
    s.undo();
    s.setSelection({ kind: "entity", id: "customers" });
    s.setNotation("chen");
    expect(useERStore.getState().future).toHaveLength(1);
    s.updateEntity("customers", { name: "people" });
    expect(useERStore.getState().future).toHaveLength(0);
  });
  it("restores deleted entities and incident relationships atomically", () => {
    const s = useERStore.getState();
    s.deleteEntity("orders");
    expect(useERStore.getState().graph.relationships).toHaveLength(0);
    s.undo();
    expect(useERStore.getState().graph).toEqual(seedGraph);
  });
  it("updates nested attributes and duplicates with fresh identifiers", () => {
    const s = useERStore.getState();
    s.addAttribute("customers", "c-name");
    let e = useERStore.getState().graph.entities[0];
    const id = e.attributes[2].compositeChildren![0].id;
    s.updateAttribute(e.id, id, { name: "first_name" });
    s.duplicateEntity(e.id);
    const copy = useERStore.getState().graph.entities.at(-1)!;
    expect(copy.attributes[2].compositeChildren![0].name).toBe("first_name");
    expect(copy.attributes[2].compositeChildren![0].id).not.toBe(id);
  });
});
it("does not add empty focus transactions to history", () => {
  const s = useERStore.getState();
  s.beginTransaction();
  s.endTransaction();
  expect(useERStore.getState().past).toHaveLength(0);
});
