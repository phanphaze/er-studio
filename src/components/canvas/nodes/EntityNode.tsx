"use client";
import { memo, useEffect } from "react";
import {
  Handle,
  NodeToolbar,
  Position,
  useUpdateNodeInternals,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import {
  Copy,
  GripVertical,
  KeyRound,
  Plus,
  Trash2,
  Table2,
} from "lucide-react";
import { useERStore } from "@/store/useERStore";
import {
  DATA_TYPES,
  type Entity,
  type DataType,
  type RelationalColumn,
} from "@/lib/ast/types";
import { Button } from "@/components/ui/button";
export type EntityFlowNode = Node<
  { entity: Entity; foreignColumns?: RelationalColumn[] },
  "entity"
>;
export const EntityNode = memo(function EntityNode({
  id,
  data,
  selected,
}: NodeProps<EntityFlowNode>) {
  const { entity } = data;
  const notation = useERStore((s) => s.notation);
  const update = useERStore((s) => s.updateAttribute);
  const begin = useERStore((s) => s.beginTransaction);
  const end = useERStore((s) => s.endTransaction);
  const internals = useUpdateNodeInternals();
  useEffect(() => {
    internals(id);
  }, [id, entity.attributes, data.foreignColumns, notation, internals]);
  return (
    <div
      className={`entity-node ${selected ? "is-selected" : ""} ${notation === "chen" ? "entity-chen" : ""} ${entity.type === "weak" ? "entity-weak" : ""}`}
      style={{ "--entity-color": entity.color } as React.CSSProperties}
    >
      <NodeToolbar
        isVisible={selected}
        position={Position.Top}
        className="floating-actions"
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => useERStore.getState().addAttribute(id)}
        >
          <Plus size={15} /> Attribute
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title="Duplicate entity"
          onClick={() => useERStore.getState().duplicateEntity(id)}
        >
          <Copy size={15} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title="Delete entity"
          onClick={() => useERStore.getState().deleteEntity(id)}
        >
          <Trash2 size={15} />
        </Button>
      </NodeToolbar>
      <Handle id="in" type="target" position={Position.Left} />
      <Handle id="out" type="source" position={Position.Right} />
      <header className="entity-drag">
        <Table2 size={17} />
        <input
          aria-label="Entity name"
          className="nodrag entity-name"
          value={entity.name}
          onFocus={begin}
          onBlur={end}
          onChange={(e) =>
            useERStore.getState().updateEntity(id, { name: e.target.value })
          }
        />
        <span className="entity-kind">
          {notation === "uml"
            ? "«entity»"
            : entity.type === "regular"
              ? "TABLE"
              : entity.type.toUpperCase()}
        </span>
      </header>
      <div className="column-heading">
        <span>FIELD</span>
        <span>TYPE</span>
      </div>
      {entity.attributes.map((a, i) => (
        <div
          key={a.id}
          className={`attribute-row ${a.isDerived ? "derived" : ""}`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const from = e.dataTransfer.getData("application/er-attribute");
            useERStore.getState().reorderAttribute(id, from, i);
          }}
        >
          <button
            className="attribute-grip nodrag"
            draggable
            aria-label={`Move ${a.name}; use arrow keys to reorder`}
            onDragStart={(e) =>
              e.dataTransfer.setData("application/er-attribute", a.id)
            }
            onKeyDown={(e) => {
              if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                e.preventDefault();
                useERStore
                  .getState()
                  .reorderAttribute(
                    id,
                    a.id,
                    i + (e.key === "ArrowUp" ? -1 : 1),
                  );
              }
            }}
          >
            <GripVertical size={12} />
          </button>
          <span
            className={`key-badge ${a.isPrimaryKey || a.isPartialKey ? "pk" : ""}`}
            title={
              a.isPrimaryKey
                ? "Primary key"
                : a.isPartialKey
                  ? "Partial key"
                  : a.isDerived
                    ? "Derived"
                    : a.isMultivalued
                      ? "Multivalued"
                      : "Attribute"
            }
          >
            {a.isPrimaryKey || a.isPartialKey ? (
              <KeyRound size={12} />
            ) : a.isDerived ? (
              "ƒ"
            ) : a.isMultivalued ? (
              "≋"
            ) : (
              "·"
            )}
          </span>
          <input
            className="nodrag attribute-name"
            aria-label={`Attribute ${i + 1} name`}
            value={a.name}
            onFocus={begin}
            onBlur={end}
            onChange={(e) => update(id, a.id, { name: e.target.value })}
          />
          <select
            className="nodrag attribute-type"
            aria-label={`${a.name} type`}
            value={a.type}
            onChange={(e) =>
              update(id, a.id, { type: e.target.value as DataType })
            }
          >
            {DATA_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <Handle
            id={`attr-in-${a.id}`}
            type="target"
            position={Position.Left}
          />
          <Handle
            id={`attr-out-${a.id}`}
            type="source"
            position={Position.Right}
          />
        </div>
      ))}
      {data.foreignColumns?.map((c) => (
        <div className="attribute-row generated-column" key={c.name}>
          <span className="fk-badge">FK</span>
          <span className="attribute-name" title={c.name}>
            {c.name}
          </span>
          <span className="attribute-type">{c.type}</span>
        </div>
      ))}
      <footer>
        <span>{entity.attributes.length} fields</span>
        <button
          className="nodrag"
          onClick={() => useERStore.getState().addAttribute(id)}
          aria-label="Add attribute"
        >
          <Plus size={14} /> Add field
        </button>
      </footer>
    </div>
  );
});
