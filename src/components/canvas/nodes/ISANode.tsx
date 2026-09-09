"use client";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { ConnectionPorts } from "./ConnectionPorts";
import type { Port } from "@/lib/layout/geometry";
import type { Specialization } from "@/lib/ast/types";
export function ISANode({
  data,
  id,
}: NodeProps<Node<{ specialization: Specialization; ports?: Port[] }, "isa">>) {
  const s = data.specialization;
  return (
    <div className="isa-node">
      <ConnectionPorts nodeId={id} ports={data.ports} />
      <Handle type="target" position={Position.Top} id="in" />
      <strong>ISA · {s.disjointness === "disjoint" ? "d" : "o"}</strong>
      <small>{s.completeness}</small>
      <Handle type="source" position={Position.Bottom} id="out" />
    </div>
  );
}
