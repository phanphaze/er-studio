"use client";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { Specialization } from "@/lib/ast/types";
export function ISANode({
  data,
}: NodeProps<Node<{ specialization: Specialization }, "isa">>) {
  const s = data.specialization;
  return (
    <div className="isa-node">
      <Handle type="target" position={Position.Top} id="in" />
      <strong>ISA · {s.disjointness === "disjoint" ? "d" : "o"}</strong>
      <small>{s.completeness}</small>
      <Handle type="source" position={Position.Bottom} id="out" />
    </div>
  );
}
