import type { Node, Edge } from "@xyflow/react";
import type { Point } from "../ast/types";
export async function organize(
  nodes: Node[],
  edges: Edge[],
): Promise<Record<string, Point>> {
  const { default: ELK } = await import("elkjs/lib/elk.bundled.js");
  const elk = new ELK();
  const graph = await elk.layout({
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.spacing.nodeNode": "90",
      "elk.layered.spacing.nodeNodeBetweenLayers": "150",
      "elk.spacing.edgeNode": "35",
      "elk.spacing.edgeEdge": "24",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.randomSeed": "1",
    },
    children: nodes.map((n) => ({
      id: n.id,
      width: n.width ?? 180,
      height: n.height ?? 80,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target],
    })),
  });
  return Object.fromEntries(
    (graph.children ?? []).map((n) => [
      n.id,
      {
        x: Math.round((n.x ?? 0) / 10) * 10,
        y: Math.round((n.y ?? 0) / 10) * 10,
      },
    ]),
  );
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
