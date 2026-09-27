"use client";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";
import { pathData, labelPoint } from "@/lib/layout/geometry";
import { CardinalityMarks, compactBounds } from "./CardinalityMarks";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useERStore } from "@/store/useERStore";
import type { ERLinkData } from "./CrowsFootEdge";
export function ChenEdge(props: EdgeProps) {
  const d = props.data as ERLinkData;
  const display = useSettingsStore((s) => s.cardinalityDisplay);
  const marked = d.endpoint && (display === "arrows" || display === "crow");
  let [path, x, y] = getSmoothStepPath(props);
  if (d.points?.length) {
    path = pathData(d.points);
    const p = labelPoint(d.points);
    x = p.x;
    y = p.y;
  }
  if (d.labelPosition) {
    x = d.labelPosition.x;
    y = d.labelPosition.y;
  }
  const select = () => {
    if (d.relationshipId)
      useERStore
        .getState()
        .setSelection({ kind: "relationship", id: d.relationshipId });
    else if (d.specializationId)
      useERStore
        .getState()
        .setSelection({ kind: "specialization", id: d.specializationId });
  };
  const stroke = props.selected ? "var(--accent)" : "var(--edge-color,#8993a8)";
  return (
    <>
      {d.labelAnchor &&
        d.labelPosition &&
        Math.hypot(x - d.labelAnchor.x, y - d.labelAnchor.y) > 12 && (
          <path
            d={`M ${d.labelAnchor.x} ${d.labelAnchor.y} L ${x} ${y}`}
            stroke="var(--edge-color)"
            strokeWidth={1}
            strokeDasharray="3 4"
            opacity={0.5}
            fill="none"
            pointerEvents="none"
          />
        )}
      {marked && <CardinalityMarks id={props.id} start={d.start} end={d.end} />}
      <BaseEdge
        {...props}
        markerStart={marked ? `url(#${props.id}-s)` : undefined}
        interactionWidth={30}
        path={path}
        style={{ stroke, strokeWidth: d.mandatory ? 5 : 1.6 }}
      />
      {d.mandatory && (
        <path
          d={path}
          fill="none"
          stroke="var(--canvas-surface,#0d1017)"
          strokeWidth={2}
          pointerEvents="none"
        />
      )}
      {!d.attributeLink && d.label && (
        <EdgeLabelRenderer>
          <button
            className={`edge-label chen-edge-label nodrag nopan ${props.selected ? "selected-edge-label" : ""}`}
            title={d.label}
            onClick={select}
            style={{
              transform: `translate(-50%, -50%) translate(${x}px,${y}px)`,
            }}
          >
            {d.endpoint && display !== "words"
              ? `${d.endpointName}: ${compactBounds(d.start, display)}`
              : d.label}
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
