"use client";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";
import { useERStore } from "@/store/useERStore";
import { bounds, type ERLinkData } from "./CrowsFootEdge";
export function ChenEdge(props: EdgeProps) {
  const d = props.data as ERLinkData;
  const [path, x, y] = getSmoothStepPath(props);
  return (
    <>
      <BaseEdge
        {...props}
        interactionWidth={30}
        path={path}
        style={{ stroke: "#8993a8", strokeWidth: d.end.min === 1 ? 3 : 1.4 }}
      />
      <EdgeLabelRenderer>
        <div
          className="edge-label"
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
          {bounds(d.end)}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
