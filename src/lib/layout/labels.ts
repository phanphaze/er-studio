import { freePosition, overlap, type Box } from "./geometry";
import type { Point } from "../ast/types";
export const LABEL_WIDTH = 160,
  LABEL_HEIGHT = 32;
/** Place labels independently of edges, reserving their complete rendered bounds. */
export function placeLabel(
  id: string,
  anchor: Point,
  nodes: Box[],
  labels: Box[],
  paths: Point[][],
): Box {
  const obstacles = [...nodes, ...labels];
  const segments = paths.flatMap((path, pi) =>
    path.slice(1).map((p, i) => ({
      id: `line-${pi}-${i}`,
      x: Math.min(p.x, path[i].x) - 3,
      y: Math.min(p.y, path[i].y) - 3,
      width: Math.abs(p.x - path[i].x) + 6,
      height: Math.abs(p.y - path[i].y) + 6,
    })),
  );
  const base = {
    id,
    x: anchor.x - LABEL_WIDTH / 2,
    y: anchor.y - LABEL_HEIGHT / 2,
    width: LABEL_WIDTH,
    height: LABEL_HEIGHT,
  };
  const candidates = [0, -70, 70, -140, 140].flatMap((y) =>
    [0, -160, 160, -320, 320].map((x) => ({
      ...base,
      x: base.x + x,
      y: base.y + y,
    })),
  );
  const clear = candidates.filter(
    (b) =>
      !obstacles.some((o) => overlap(b, o, 12)) &&
      !segments.some((o) => overlap(b, o, 4)),
  );
  if (clear.length)
    return clear.sort(
      (a, b) =>
        Math.hypot(a.x - base.x, a.y - base.y) -
        Math.hypot(b.x - base.x, b.y - base.y),
    )[0];
  return { ...base, ...freePosition(base, [...obstacles, ...segments]) };
}
