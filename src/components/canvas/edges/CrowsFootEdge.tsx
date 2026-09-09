"use client";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";
import { useERStore } from "@/store/useERStore";
import { ArrowLeftRight, Trash2 } from "lucide-react";
import { isMany, participationLabel } from "@/lib/ast/participation";
import { pathData, labelPoint } from "@/lib/layout/geometry";
import type { Point } from "@/lib/ast/types";
import type { Participation } from "@/lib/ast/types";
export interface ERLinkData extends Record<string, unknown> {
  label: string;
  start: Participation;
  end: Participation;
  identifying: boolean;
  uml?: boolean;
  relationshipId?: string;
  specializationId?: string;
  mandatory?: boolean;
  attributeLink?: boolean;
  cardinality?: string;
  points?: Point[];
}
export const bounds = participationLabel;
export function CrowsFootEdge(props: EdgeProps) {
  const d = props.data as ERLinkData;
  let [path, x, y] = getSmoothStepPath({ ...props, borderRadius: 16 });
  if (!d.points && props.source === props.target) {
    path = `M ${props.sourceX} ${props.sourceY} C ${props.sourceX + 190} ${props.sourceY - 240}, ${props.targetX - 190} ${props.targetY - 240}, ${props.targetX} ${props.targetY}`;
    x = (props.sourceX + props.targetX) / 2;
    y = props.sourceY - 180;
  }
  if (d.points?.length) {
    path = pathData(d.points);
    const label = labelPoint(d.points);
    x = label.x;
    y = label.y;
  }
  const marker = (p: Participation, suffix: string) => (
    <marker
      id={`${props.id}-${suffix}`}
      viewBox="0 -9 24 18"
      refX="1"
      refY="0"
      markerWidth="24"
      markerHeight="18"
      orient="auto-start-reverse"
      markerUnits="userSpaceOnUse"
    >
      {isMany(p) ? <path d="M 2,-7 L 16,0 L 2,7" /> : <path d="M 7,-7 V 7" />}
      {p.min === 0 ? (
        <circle cx="20" cy="0" r="3" fill="var(--canvas-surface,#13161d)" />
      ) : (
        <path d="M 18,-7 V 7" />
      )}
    </marker>
  );
  return (
    <>
      <defs>
        <g
          stroke={props.selected ? "#b59aff" : "#6b778e"}
          fill="none"
          strokeWidth="1.5"
        >
          {marker(d.start, "s")}
          {marker(d.end, "e")}
        </g>
      </defs>
      <BaseEdge
        {...props}
        interactionWidth={30}
        path={path}
        markerStart={d.uml ? undefined : `url(#${props.id}-s)`}
        markerEnd={d.uml ? undefined : `url(#${props.id}-e)`}
        style={{
          stroke: props.selected
            ? "var(--accent)"
            : "var(--edge-color,#69758b)",
          strokeWidth: 1.6,
          strokeDasharray: d.identifying ? undefined : "6 4",
        }}
      />
      <EdgeLabelRenderer>
        <div
          className={`edge-label ${props.selected ? "selected-edge-label" : ""}`}
          onClick={() => {
            if (d.relationshipId)
              useERStore
                .getState()
                .setSelection({ kind: "relationship", id: d.relationshipId });
          }}
          style={{
            pointerEvents: "all",
            cursor: "pointer",
            transform: `translate(-50%, -50%) translate(${x}px,${y}px)`,
          }}
        >
          <strong>{d.label}</strong>
          <span className="edge-cardinality">{d.cardinality}</span>
          {props.selected && (
            <small>
              {participationLabel(d.start)} ↔ {participationLabel(d.end)}
            </small>
          )}
          {props.selected && d.relationshipId && (
            <span className="edge-actions nodrag nopan">
              <button
                title="Invert cardinality"
                onClick={() =>
                  useERStore.getState().invertCardinality(d.relationshipId!)
                }
              >
                <ArrowLeftRight size={13} />
              </button>
              <button
                title="Delete relationship"
                onClick={() =>
                  useERStore.getState().deleteRelationship(d.relationshipId!)
                }
              >
                <Trash2 size={13} />
              </button>
            </span>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
