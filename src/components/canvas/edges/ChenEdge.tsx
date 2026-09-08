"use client";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";
import { bounds, type ERLinkData } from "./CrowsFootEdge";
export function ChenEdge(props: EdgeProps) {
  const d = props.data as ERLinkData;
  const [path, x, y] = getSmoothStepPath(props);
  return (
    <>
      <BaseEdge
        {...props}
        path={path}
        style={{ stroke: "#8993a8", strokeWidth: d.end.min === 1 ? 3 : 1.4 }}
      />
      <EdgeLabelRenderer>
        <div
          className="edge-label"
          style={{
            transform: `translate(-50%, -50%) translate(${x}px,${y}px)`,
          }}
        >
          {bounds(d.end)}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
