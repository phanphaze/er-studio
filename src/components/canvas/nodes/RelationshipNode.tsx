"use client";
import type { CSSProperties } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import type { Notation, Relationship } from "@/lib/ast/types";
import type { Port } from "@/lib/layout/geometry";
import { ConnectionPorts } from "./ConnectionPorts";
import { attributeRows } from "@/lib/ast/attributes";
import { useERStore } from "@/store/useERStore";
import { AttributeMenu } from "@/components/ui/attribute-menu";
export function RelationshipNode({
  id,
  data,
  selected,
}: NodeProps<
  Node<
    { relationship: Relationship; ports?: Port[]; notation: Notation },
    "relationship"
  >
>) {
  const r = data.relationship;
  return (
    <div
      style={{ "--relationship-color": r.color ?? "#ac94ca" } as CSSProperties}
      className={`relationship-card chen-diamond ${selected ? "is-selected" : ""}`}
    >
      <ConnectionPorts nodeId={id} ports={data.ports} />
      <svg
        className="diamond-shape"
        viewBox="0 0 180 110"
        preserveAspectRatio="none"
      >
        <polygon points="90,2 178,55 90,108 2,55" />
        {r.type === "identifying" && (
          <polygon points="90,9 167,55 90,101 13,55" />
        )}
      </svg>
      <strong title={r.name}>{r.name}</strong>
    </div>
  );
}
