"use client";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { Attribute } from "@/lib/ast/types";
export function AttributeNode({
  data,
}: NodeProps<Node<{ attribute: Attribute }, "attribute">>) {
  const a = data.attribute;
  return (
    <div
      className={`chen-attribute ${a.isMultivalued ? "multivalued" : ""} ${a.isDerived ? "derived" : ""}`}
    >
      <Handle id="in" type="target" position={Position.Bottom} />
      <span
        style={{
          textDecoration:
            a.isPrimaryKey || a.isPartialKey ? "underline" : undefined,
          textDecorationStyle: a.isPartialKey ? "dashed" : undefined,
        }}
      >
        {a.name}
      </span>
      <Handle id="out" type="source" position={Position.Top} />
    </div>
  );
}
