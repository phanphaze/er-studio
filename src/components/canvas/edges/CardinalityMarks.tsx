"use client";
import type { Participation } from "@/lib/ast/types";
import { isMany } from "@/lib/ast/participation";
import { useSettingsStore } from "@/store/useSettingsStore";
export function compactBounds(p: Participation, style: string) {
  const max = p.max === "*" ? "*" : p.max;
  return style === "minmax" ? `(${p.min}, ${max})` : `${p.min}..${max}`;
}
export function CardinalityMarks({
  id,
  start,
  end,
}: {
  id: string;
  start: Participation;
  end: Participation;
}) {
  const style = useSettingsStore((s) => s.cardinalityDisplay);
  const marker = (p: Participation, suffix: string) => (
    <marker
      id={`${id}-${suffix}`}
      viewBox="-2 -10 30 20"
      refX="0"
      refY="0"
      markerWidth="30"
      markerHeight="20"
      orient="auto-start-reverse"
      markerUnits="userSpaceOnUse"
      stroke="var(--edge-color)"
      fill="none"
      strokeWidth="1.6"
    >
      {style === "arrows" ? (
        <>
          <path d="M 12,-7 L 1,0 L 12,7" />
          {isMany(p) && <path d="M 21,-7 L 10,0 L 21,7" />}
        </>
      ) : (
        <>
          {isMany(p) ? (
            <path d="M 1,-7 L 15,0 L 1,7 M 1,0 H 15" />
          ) : (
            <path d="M 7,-7 V 7" />
          )}
          {p.min === 0 ? (
            <circle cx="22" cy="0" r="3" fill="var(--canvas-surface)" />
          ) : (
            <path d="M 20,-7 V 7" />
          )}
        </>
      )}
    </marker>
  );
  return (
    <defs>
      {marker(start, "s")}
      {marker(end, "e")}
    </defs>
  );
}
