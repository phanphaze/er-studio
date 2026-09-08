"use client";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { Relationship } from "@/lib/ast/types";
export function RelationshipNode({
  data,
  selected,
}: NodeProps<Node<{ relationship: Relationship }, "relationship">>) {
  return (
    <div className={`relationship-diamond ${selected ? "is-selected" : ""}`}>
      <Handle type="target" position={Position.Left} id="in" />
      <span>{data.relationship.name}</span>
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}
