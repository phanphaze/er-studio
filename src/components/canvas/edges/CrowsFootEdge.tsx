"use client";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";
import { CardinalityMarks, compactBounds } from "./CardinalityMarks";
import { useSettingsStore } from "@/store/useSettingsStore";
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
  endpoint?: boolean;
  endpointName?: string;
  attributeLink?: boolean;
  cardinality?: string;
  points?: Point[];
  labelPosition?: Point;
  labelAnchor?: Point;
}
export const bounds = participationLabel;
export function CrowsFootEdge(props: EdgeProps) {
  const d = props.data as ERLinkData;
  const display = useSettingsStore((s) => s.cardinalityDisplay);
  const marked = !d.uml;
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
  if (d.labelPosition) {
    x = d.labelPosition.x;
    y = d.labelPosition.y;
  }
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
      <CardinalityMarks
        id={props.id}
        start={d.start}
        end={d.end}
        variant="crow"
      />
      <BaseEdge
        {...props}
        interactionWidth={30}
        path={path}
        markerStart={marked ? `url(#${props.id}-s)` : undefined}
        markerEnd={marked && !d.endpoint ? `url(#${props.id}-e)` : undefined}
        style={{
          stroke: props.selected
            ? "var(--accent)"
            : "var(--edge-color,#69758b)",
          strokeWidth: 1.6,
          strokeDasharray: d.uml || d.identifying ? undefined : "6 4",
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
          <span className="edge-cardinality">
            {d.endpoint
              ? compactBounds(d.start, display)
              : display === "words" && !d.uml
                ? d.cardinality
                : `${compactBounds(d.start, display)} ↔ ${compactBounds(d.end, display)}`}
          </span>
          {props.selected && (
            <small>
              {participationLabel(d.start)} ↔ {participationLabel(d.end)}
            </small>
          )}
          {props.selected && d.relationshipId && (
            <span className="edge-actions nodrag nopan">
              <button
                title="Invert cardinality"
                disabled={
                  useERStore
                    .getState()
                    .graph.relationships.find((r) => r.id === d.relationshipId)
                    ?.endpoints.length !== 2
                }
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
