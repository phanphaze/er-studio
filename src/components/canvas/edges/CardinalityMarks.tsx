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
  color,
}: {
  color?: string;
  id: string;
  start: Participation;
  end: Participation;
}) {
  const style = useSettingsStore((s) => s.cardinalityDisplay);
  if (style !== "arrows" && style !== "crow") return null;
  const marker = (p: Participation, suffix: string) => (
    <marker
      id={`${id}-${suffix}`}
      viewBox="0 -11 32 22"
      refX="29"
      refY="0"
      markerWidth="32"
      markerHeight="22"
      orient="auto-start-reverse"
      markerUnits="userSpaceOnUse"
      stroke={color ?? "var(--edge-color)"}
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

export function inlineBounds(p: Participation, display: string) {
  if (display !== "words") return compactBounds(p, display);
  if (p.max === 1) return p.min === 0 ? "Zero or one" : "Exactly one";
  if (p.max === "*")
    return p.min === 0
      ? "Zero or more"
      : p.min === 1
        ? "One or more"
        : `At least ${p.min}`;
  return p.min === p.max ? `Exactly ${p.min}` : `${p.min} to ${p.max}`;
}
