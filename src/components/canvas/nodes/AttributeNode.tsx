"use client";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { ConnectionPorts } from "./ConnectionPorts";
import type { Port } from "@/lib/layout/geometry";
import { useERStore } from "@/store/useERStore";
import { AttributeNestGrip } from "./AttributeNestGrip";
import { AttributeMenu } from "@/components/ui/attribute-menu";
import type { Attribute } from "@/lib/ast/types";
export function AttributeNode({
  data,
  id,
}: NodeProps<
  Node<{ attribute: Attribute; ownerId: string; ports?: Port[] }, "attribute">
>) {
  const a = data.attribute;
  return (
    <AttributeMenu
      ownerId={data.ownerId}
      attributeId={a.id}
      hasChildren={!!a.compositeChildren?.length}
    >
      <div
        tabIndex={0}
        role="button"
        aria-label={`Edit ${a.name}`}
        onClick={(e) => {
          e.stopPropagation();
          useERStore.getState().focusAttribute(data.ownerId, a.id);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            useERStore.getState().focusAttribute(data.ownerId, a.id);
          }
        }}
        className={`chen-attribute ${a.isMultivalued ? "multivalued" : ""} ${a.isDerived ? "derived" : ""}`}
      >
        <ConnectionPorts nodeId={id} ports={data.ports} />
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
        <AttributeNestGrip ownerId={data.ownerId} attributeId={a.id} />
        <Handle id="out" type="source" position={Position.Top} />
      </div>
    </AttributeMenu>
  );
}
