import { it, expect } from "vitest";
import { seedGraph, attribute } from "../src/store/seed";
import { projectGraph } from "../src/lib/layout/projection";
import {
  facing,
  route,
  segmentHits,
  overlap,
  type Box,
  type Port,
} from "../src/lib/layout/geometry";
import { organize, aligned } from "../src/lib/layout/organize";
import { parseModel } from "../src/lib/ast/serialization";
import { compileGraph } from "../src/lib/compiler/sqlGenerator";
import { useERStore } from "../src/store/useERStore";
import {
  cardinalityFor,
  participationLabel,
} from "../src/lib/ast/participation";
it("places nested entity and relationship attributes without Chen node overlap", () => {
  const g = structuredClone(seedGraph);
  g.entities[0].attributes[1].compositeChildren = [
    attribute("nested-a", "street"),
    {
      ...attribute("nested-b", "location"),
      compositeChildren: [attribute("nested-c", "country")],
    },
  ];
  const p = projectGraph(g, "chen", null);
  expect(p.nodes.some((n) => n.id === "quantity")).toBe(true);
  const boxes = p.nodes.map((n) => ({
    id: n.id,
    ...n.position,
    width: n.width!,
    height: n.height!,
  }));
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++)
      expect(
        overlap(boxes[i], boxes[j], 0),
        `${boxes[i].id} overlaps ${boxes[j].id}`,
      ).toBe(false);
});
it("routes rightmost to leftmost from the facing sides and avoids an intervening entity", () => {
  const a: Box = { id: "a", x: 500, y: 0, width: 100, height: 100 },
    b: Box = { id: "b", x: 0, y: 0, width: 100, height: 100 },
    obstacle: Box = { id: "obstacle", x: 250, y: -40, width: 100, height: 180 };
  expect(facing(a, b)).toEqual(["left", "right"]);
  const points = route({ x: 500, y: 50 }, { x: 100, y: 50 }, "left", "right", [
    a,
    b,
    obstacle,
  ]);
  for (let i = 1; i < points.length; i++)
    expect(segmentHits(points[i - 1], points[i], obstacle)).toBe(false);
});
it("assigns separate per-edge ports and respects spacing", () => {
  const p = projectGraph(seedGraph, "crows-foot", null);
  const used = new Set<string>();
  for (const n of p.nodes) {
    const ports = n.data.ports as Port[];
    for (const port of ports) {
      expect(used.has(port.id)).toBe(false);
      used.add(port.id);
    }
    for (const side of ["left", "right", "top", "bottom"]) {
      const fractions = ports
        .filter((p) => p.side === side)
        .map((p) => p.fraction);
      expect(new Set(fractions).size).toBe(fractions.length);
    }
  }
});
it("auto-organizes deterministically, saves notation layouts, and supports undo", async () => {
  const g = structuredClone(seedGraph),
    p = projectGraph(g, "chen", null);
  const a = await organize(p.nodes, p.edges),
    b = await organize(p.nodes, p.edges);
  expect(a).toEqual(b);
  g.layouts = { chen: a };
  expect(parseModel(JSON.stringify(g)).layouts).toEqual(g.layouts);
  const arranged = projectGraph(g, "chen", null);
  const boxes = arranged.nodes.map((n) => ({
    id: n.id,
    ...n.position,
    width: n.width!,
    height: n.height!,
  }));
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++)
      expect(overlap(boxes[i], boxes[j], 0)).toBe(false);
  useERStore.setState({
    graph: structuredClone(seedGraph),
    past: [],
    future: [],
    transactionBase: null,
  });
  useERStore.getState().commit((g) => {
    g.layouts = { chen: a };
  });
  useERStore.getState().undo();
  expect(useERStore.getState().graph.layouts).toBeUndefined();
});
it("aligns without piling nodes on top of each other", () => {
  const p = projectGraph(seedGraph, "crows-foot", null);
  const nodes = p.nodes.filter((n) => n.type === "entity");
  const positions = aligned(nodes, "top");
  expect(new Set(Object.values(positions).map((p) => p.y)).size).toBe(1);
  const boxes = nodes.map((n) => ({
    id: n.id,
    ...positions[n.id],
    width: n.width!,
    height: n.height!,
  }));
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++)
      expect(overlap(boxes[i], boxes[j], 0)).toBe(false);
});
it("models mandatory and bounded participation while explaining SQL enforcement limits", () => {
  const g = structuredClone(seedGraph);
  g.relationships[0].endpoints[1].participation = { min: 2, max: 5 };
  g.relationships[0].cardinality = cardinalityFor(g.relationships[0].endpoints);
  expect(g.relationships[0].cardinality).toBe("1:N");
  expect(participationLabel({ min: 0, max: 1 })).toBe("Optional · zero or one");
  expect(parseModel(JSON.stringify(g))).toEqual(g);
  const compiled = compileGraph(g);
  expect(compiled.sql).not.toBe("");
  expect(
    compiled.issues.some((i) => i.message.includes("exact participant counts")),
  ).toBe(true);
  const p = projectGraph(g, "chen", null);
  expect(p.edges.find((e) => e.id === "places-0")?.data?.mandatory).toBe(true);
  g.relationships[0].endpoints[1].participation = { min: 6, max: 5 };
  expect(compileGraph(g).sql).toBe("");
});
