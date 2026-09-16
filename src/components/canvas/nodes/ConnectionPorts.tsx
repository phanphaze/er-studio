"use client";
import { Handle, Position, useUpdateNodeInternals } from "@xyflow/react";
import { useEffect } from "react";
import type { Port } from "@/lib/layout/geometry";
export function ConnectionPorts({
  nodeId,
  ports = [],
}: {
  nodeId: string;
  ports?: Port[];
}) {
  const update = useUpdateNodeInternals();
  useEffect(() => {
    update(nodeId);
  }, [nodeId, ports, update]);
  return (
    <>
      {ports.map((p) => (
        <Handle
          key={p.id}
          id={p.id}
          type={p.type}
          position={
            {
              left: Position.Left,
              right: Position.Right,
              top: Position.Top,
              bottom: Position.Bottom,
            }[p.side]
          }
          className="routed-port"
          isConnectable={false}
          style={
            p.side === "left" || p.side === "right"
              ? { top: `${p.fraction * 100}%` }
              : { left: `${p.fraction * 100}%` }
          }
        />
      ))}
    </>
  );
}
