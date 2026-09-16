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
  variant,
}: {
  id: string;
  start: Participation;
  end: Participation;
  variant?: "crow" | "arrows";
}) {
  const preference = useSettingsStore((s) => s.cardinalityDisplay);
  const style = variant ?? preference;
  const marker = (p: Participation, suffix: string) => (
    <marker
      id={`${id}-${suffix}`}
      viewBox="-2 -10 30 20"
      refX="29"
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
          <path d="M 18,-7 L 29,0 L 18,7" />
          {isMany(p) && <path d="M 8,-7 L 19,0 L 8,7" />}
        </>
      ) : (
        <>
          {isMany(p) ? (
            <path d="M 29,-7 L 15,0 L 29,7 M 29,0 H 15" />
          ) : (
            <path d="M 23,-7 V 7" />
          )}
          {p.min === 0 ? (
            <circle cx="7" cy="0" r="3" fill="var(--canvas-surface)" />
          ) : (
            <path d="M 9,-7 V 7" />
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
