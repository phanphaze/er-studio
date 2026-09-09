import type { Point } from "../ast/types";
export interface Box extends Point {
  id: string;
  width: number;
  height: number;
}
export type Side = "left" | "right" | "top" | "bottom";
export interface Port {
  id: string;
  side: Side;
  fraction: number;
  type: "source" | "target";
}
export const overlap = (a: Box, b: Box, gap = 20) =>
  a.x < b.x + b.width + gap &&
  a.x + a.width + gap > b.x &&
  a.y < b.y + b.height + gap &&
  a.y + a.height + gap > b.y;
export function freePosition(box: Box, occupied: Box[]): Point {
  if (!occupied.some((b) => overlap(box, b))) return { x: box.x, y: box.y };
  for (let radius = 1; radius < 150; radius++)
    for (let x = -radius; x <= radius; x++)
      for (const y of [-radius, radius]) {
        const p = { ...box, x: box.x + x * 100, y: box.y + y * 90 };
        if (!occupied.some((b) => overlap(p, b))) return { x: p.x, y: p.y };
      }
  return {
    x: box.x,
    y: Math.max(0, ...occupied.map((b) => b.y + b.height)) + 60,
  };
}
export function facing(a: Box, b: Box): [Side, Side] {
  const dx = b.x + b.width / 2 - a.x - a.width / 2,
    dy = b.y + b.height / 2 - a.y - a.height / 2;
  if (a.id === b.id) return ["right", "top"];
  if (
    Math.abs(dx) / (a.width / 2 + b.width / 2) >
    Math.abs(dy) / (a.height / 2 + b.height / 2)
  )
    return dx >= 0 ? ["right", "left"] : ["left", "right"];
  return dy >= 0 ? ["bottom", "top"] : ["top", "bottom"];
}
export function portPoint(b: Box, p: Port): Point {
  return {
    x:
      p.side === "left"
        ? b.x
        : p.side === "right"
          ? b.x + b.width
          : b.x + b.width * p.fraction,
    y:
      p.side === "top"
        ? b.y
        : p.side === "bottom"
          ? b.y + b.height
          : b.y + b.height * p.fraction,
  };
}
const extend = (p: Point, side: Side, n = 28): Point => ({
  x: p.x + (side === "left" ? -n : side === "right" ? n : 0),
  y: p.y + (side === "top" ? -n : side === "bottom" ? n : 0),
});
export function segmentHits(a: Point, b: Point, r: Box) {
  if (a.x === b.x)
    return (
      a.x > r.x &&
      a.x < r.x + r.width &&
      Math.max(a.y, b.y) > r.y &&
      Math.min(a.y, b.y) < r.y + r.height
    );
  if (a.y === b.y)
    return (
      a.y > r.y &&
      a.y < r.y + r.height &&
      Math.max(a.x, b.x) > r.x &&
      Math.min(a.x, b.x) < r.x + r.width
    );
  return false;
}
const distance = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
function crossing(a: Point, b: Point, c: Point, d: Point) {
  if (a.x === b.x && c.x === d.x)
    return (
      Math.abs(a.x - c.x) < 8 &&
      Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y)) >
        Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y))
    );
  if (a.y === b.y && c.y === d.y)
    return (
      Math.abs(a.y - c.y) < 8 &&
      Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) >
        Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x))
    );
  if (a.x === b.x)
    return (
      a.x >= Math.min(c.x, d.x) &&
      a.x <= Math.max(c.x, d.x) &&
      c.y >= Math.min(a.y, b.y) &&
      c.y <= Math.max(a.y, b.y)
    );
  return crossing(c, d, a, b);
}
export function route(
  start: Point,
  end: Point,
  sourceSide: Side,
  targetSide: Side,
  boxes: Box[],
  previous: Point[][] = [],
): Point[] {
  const s = extend(start, sourceSide),
    t = extend(end, targetSide);
  const obstacles = boxes.map((b) => ({
    ...b,
    x: b.x - 12,
    y: b.y - 12,
    width: b.width + 24,
    height: b.height + 24,
  }));
  const candidates: Point[][] = [
    [s, { x: t.x, y: s.y }, t],
    [s, { x: s.x, y: t.y }, t],
  ];
  const xs = [
      (s.x + t.x) / 2,
      ...obstacles.flatMap((b) => [b.x - 10, b.x + b.width + 10]),
    ],
    ys = [
      (s.y + t.y) / 2,
      ...obstacles.flatMap((b) => [b.y - 10, b.y + b.height + 10]),
    ];
  for (const x of xs) candidates.push([s, { x, y: s.y }, { x, y: t.y }, t]);
  for (const y of ys) candidates.push([s, { x: s.x, y }, { x: t.x, y }, t]);
  const hits = (ps: Point[]) =>
    ps
      .slice(1)
      .reduce(
        (sum, p, i) =>
          sum + obstacles.filter((b) => segmentHits(ps[i], p, b)).length,
        0,
      );
  const score = (ps: Point[]) =>
    hits(ps) * 1e7 +
    ps
      .slice(1)
      .reduce(
        (sum, p, i) =>
          sum +
          distance(ps[i], p) +
          previous.reduce(
            (n, line) =>
              n +
              line.slice(1).filter((q, j) => crossing(ps[i], p, line[j], q))
                .length *
                90,
            0,
          ),
        0,
      ) +
    ps.length * 8;
  let best = candidates.reduce((a, b) => (score(a) <= score(b) ? a : b));
  if (hits(best)) {
    // Bounded orthogonal grid search for obstacles requiring more than three bends.
    const xv = [...new Set([s.x, t.x, ...xs])].sort((a, b) => a - b),
      yv = [...new Set([s.y, t.y, ...ys])].sort((a, b) => a - b);
    if (xv.length * yv.length < 40000) {
      const key = (x: number, y: number) => `${x},${y}`;
      const initial = { x: xv.indexOf(s.x), y: yv.indexOf(s.y) };
      const goal = { x: xv.indexOf(t.x), y: yv.indexOf(t.y) };
      const open = [{ ...initial, cost: 0, priority: distance(s, t) }],
        costs = new Map([[key(initial.x, initial.y), 0]]),
        parents = new Map<string, string>();
      let steps = 0;
      while (open.length && steps++ < 12000) {
        open.sort((a, b) => b.priority - a.priority);
        const cur = open.pop()!,
          ck = key(cur.x, cur.y);
        if (cur.cost !== costs.get(ck)) continue;
        if (cur.x === goal.x && cur.y === goal.y) {
          const path: Point[] = [];
          let k: string | undefined = ck;
          while (k) {
            const [x, y] = k.split(",").map(Number);
            path.unshift({ x: xv[x], y: yv[y] });
            k = parents.get(k);
          }
          best = path;
          break;
        }
        const p = { x: xv[cur.x], y: yv[cur.y] };
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const x = cur.x + dx,
            y = cur.y + dy;
          if (x < 0 || y < 0 || x >= xv.length || y >= yv.length) continue;
          const q = { x: xv[x], y: yv[y] };
          if (obstacles.some((b) => segmentHits(p, q, b))) continue;
          const cost = cur.cost + distance(p, q) + 2,
            k = key(x, y);
          if (cost >= (costs.get(k) ?? Infinity)) continue;
          costs.set(k, cost);
          parents.set(k, ck);
          open.push({ x, y, cost, priority: cost + distance(q, t) });
        }
      }
    }
  }
  const all = [start, ...best, end].filter(
    (p, i, ps) => i === 0 || p.x !== ps[i - 1].x || p.y !== ps[i - 1].y,
  );
  return all.filter(
    (p, i) =>
      i === 0 ||
      i === all.length - 1 ||
      !(
        (all[i - 1].x === p.x && p.x === all[i + 1].x) ||
        (all[i - 1].y === p.y && p.y === all[i + 1].y)
      ),
  );
}
export function pathData(points: Point[]): string {
  return points.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ");
}
export function labelPoint(points: Point[]): Point {
  let best = 0,
    result = points[0] ?? { x: 0, y: 0 };
  for (let i = 1; i < points.length; i++) {
    const d = distance(points[i - 1], points[i]);
    if (d > best) {
      best = d;
      result = {
        x: (points[i - 1].x + points[i].x) / 2,
        y: (points[i - 1].y + points[i].y) / 2,
      };
    }
  }
  return result;
}
