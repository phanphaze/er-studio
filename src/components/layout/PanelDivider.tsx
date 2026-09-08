"use client";
import { useRef } from "react";
export function PanelDivider({
  side,
  width,
  onChange,
}: {
  side: "left" | "right";
  width: number;
  onChange: (width: number) => void;
}) {
  const drag = useRef<{ x: number; width: number } | null>(null);
  const clamp = (value: number) =>
    value < 65
      ? 0
      : Math.max(170, Math.min(value, Math.min(480, window.innerWidth * 0.4)));
  return (
    <div
      role="separator"
      aria-label={`Resize ${side} panel`}
      aria-orientation="vertical"
      aria-valuemin={0}
      aria-valuemax={480}
      aria-valuenow={Math.round(width)}
      tabIndex={0}
      className={`panel-divider panel-divider-${side} ${width === 0 ? "panel-divider-collapsed" : ""}`}
      title="Drag to resize · double-click to reset · arrow keys to adjust"
      onDoubleClick={() => onChange(side === "left" ? 218 : 324)}
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, width };
        e.currentTarget.setPointerCapture(e.pointerId);
        e.preventDefault();
      }}
      onPointerMove={(e) => {
        if (drag.current)
          onChange(
            clamp(
              drag.current.width +
                (e.clientX - drag.current.x) * (side === "left" ? 1 : -1),
            ),
          );
      }}
      onPointerUp={(e) => {
        drag.current = null;
        e.currentTarget.releasePointerCapture(e.pointerId);
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
      onKeyDown={(e) => {
        if (e.key === "Home") {
          e.preventDefault();
          onChange(0);
        }
        if (e.key === "End") {
          e.preventDefault();
          onChange(side === "left" ? 218 : 324);
        }
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          onChange(
            clamp(
              width +
                (e.key === "ArrowRight" ? 20 : -20) *
                  (side === "left" ? 1 : -1),
            ),
          );
        }
      }}
    >
      <span />
    </div>
  );
}
