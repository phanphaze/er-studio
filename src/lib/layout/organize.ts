import type { Node, Edge } from "@xyflow/react";
import { freePosition, type Box } from "./geometry";
import type { Point } from "../ast/types";
export async function organize(
  nodes: Node[],
  edges: Edge[],
): Promise<Record<string, Point>> {
  const core = nodes.filter(
    (n) => n.type !== "attribute" && n.type !== "entitySet",
  );
  const clusters = new Map<
    string,
    { width: number; height: number; positions: Record<string, Point> }
  >();
  for (const n of core) {
    const attrs = nodes.filter(
      (a) => a.type === "attribute" && a.data.ownerId === n.id,
    );
    const w = n.width ?? 180,
      h = n.height ?? 80;
    const boxes: Box[] = [
      { id: n.id, x: -w / 2, y: -h / 2, width: w, height: h },
    ];
    const positions: Record<string, Point> = {
      [n.id]: { x: -w / 2, y: -h / 2 },
    };
    const radius = Math.max(240, attrs.length * 55);
    attrs.forEach((a, i) => {
      const angle = (2 * Math.PI * i) / Math.max(1, attrs.length) - Math.PI / 2;
      const width = a.width ?? 220,
        height = a.height ?? 70;
      const pos = freePosition(
        {
          id: a.id,
          x: Math.cos(angle) * radius - width / 2,
          y: Math.sin(angle) * radius - height / 2,
          width,
          height,
        },
        boxes,
      );
      boxes.push({ id: a.id, ...pos, width, height });
      positions[a.id] = pos;
    });
    const x = Math.min(...boxes.map((b) => b.x)),
      y = Math.min(...boxes.map((b) => b.y));
    const width = Math.max(...boxes.map((b) => b.x + b.width)) - x;
    const height = Math.max(...boxes.map((b) => b.y + b.height)) - y;
    for (const pos of Object.values(positions)) {
      pos.x -= x;
      pos.y -= y;
    }
    clusters.set(n.id, { width, height, positions });
  }
  const seenRelationships = new Set<string>();
  const coreEdges = edges
    .filter((e) => !e.data?.attributeLink)
    .map((e) => {
      if (core.some((n) => n.id === e.target && n.type === "relationship")) {
        if (seenRelationships.has(e.target))
          return { ...e, source: e.target, target: e.source };
        seenRelationships.add(e.target);
      }
      return e;
    });
  const { default: ELK } = await import("elkjs/lib/elk.bundled.js");
  const elk = new ELK();
  const graph = await elk.layout({
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.spacing.nodeNode": "150",
      "elk.layered.spacing.nodeNodeBetweenLayers": "360",
      "elk.spacing.edgeNode": "35",
      "elk.spacing.edgeEdge": "24",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.randomSeed": "1",
    },
    children: core.map((n) => ({
      id: n.id,
      width: clusters.get(n.id)!.width,
      height: clusters.get(n.id)!.height,
    })),
    edges: coreEdges.map((e) => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target],
    })),
  });
  const result: Record<string, Point> = {};
  for (const n of graph.children ?? []) {
    for (const [id, p] of Object.entries(clusters.get(n.id)!.positions)) {
      result[id] = {
        x: Math.round(((n.x ?? 0) + p.x) / 10) * 10,
        y: Math.round(((n.y ?? 0) + p.y) / 10) * 10,
      };
    }
  }
  return result;
}
export function aligned(nodes: Node[], mode: string): Record<string, Point> {
  if (nodes.length < 2) return {};
  const minX = Math.min(...nodes.map((n) => n.position.x)),
    maxX = Math.max(...nodes.map((n) => n.position.x + (n.width ?? 0))),
    minY = Math.min(...nodes.map((n) => n.position.y)),
    maxY = Math.max(...nodes.map((n) => n.position.y + (n.height ?? 0)));
  const sorted = [...nodes].sort((a, b) =>
    mode === "vertical"
      ? a.position.y - b.position.y
      : a.position.x - b.position.x,
  );
  const total = sorted.reduce(
    (sum, n) => sum + (mode === "vertical" ? (n.height ?? 0) : (n.width ?? 0)),
    0,
  );
  const span = mode === "vertical" ? maxY - minY : maxX - minX;
  const gap = Math.max(60, (span - total) / (nodes.length - 1));
  let cursor = mode === "vertical" ? minY : minX;
  let crossCursor =
    mode === "left" || mode === "center" || mode === "right" ? minY : minX;
  return Object.fromEntries(
    sorted.map((n) => {
      let { x, y } = n.position;
      const w = n.width ?? 0,
        h = n.height ?? 0;
      switch (mode) {
        case "top":
          y = minY;
          break;
        case "middle":
          y = (minY + maxY - h) / 2;
          break;
        case "bottom":
          y = maxY - h;
          break;
        case "left":
          x = minX;
          break;
        case "center":
          x = (minX + maxX - w) / 2;
          break;
        case "right":
          x = maxX - w;
          break;
        case "horizontal":
          x = cursor;
          cursor += w + gap;
          break;
        case "vertical":
          y = cursor;
          cursor += h + gap;
          break;
      }
      if (["top", "middle", "bottom"].includes(mode)) {
        x = Math.max(x, crossCursor);
        crossCursor = x + w + 60;
      }
      if (["left", "center", "right"].includes(mode)) {
        y = Math.max(y, crossCursor);
        crossCursor = y + h + 60;
      }
      return [n.id, { x, y }];
    }),
  );
}
