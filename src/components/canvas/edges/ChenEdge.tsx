"use client";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";
import { pathData, labelPoint } from "@/lib/layout/geometry";
import { useERStore } from "@/store/useERStore";
import type { ERLinkData } from "./CrowsFootEdge";
export function ChenEdge(props: EdgeProps) {
  const d = props.data as ERLinkData;
  let [path, x, y] = getSmoothStepPath(props);
  if (d.points?.length) {
    path = pathData(d.points);
    const p = labelPoint(d.points);
    x = p.x;
    y = p.y;
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
      <BaseEdge
        {...props}
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
            onClick={select}
            style={{
              transform: `translate(-50%, -50%) translate(${x}px,${y}px)`,
            }}
          >
            {d.label}
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
