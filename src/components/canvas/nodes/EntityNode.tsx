"use client";
import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Handle,
  NodeToolbar,
  Position,
  useUpdateNodeInternals,
  useReactFlow,
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
import { ConnectionPorts } from "./ConnectionPorts";
import type { Port } from "@/lib/layout/geometry";
import { Button } from "@/components/ui/button";
import { attributeRows } from "@/lib/ast/attributes";
import { AttributeMenu } from "@/components/ui/attribute-menu";
export type EntityFlowNode = Node<
  {
    entity: Entity;
    foreignColumns?: RelationalColumn[];
    ports?: Port[];
    layoutWidth?: number;
    layoutHeight?: number;
  },
  "entity"
>;
export const EntityNode = memo(function EntityNode({
  id,
  data,
  selected,
}: NodeProps<EntityFlowNode>) {
  const { entity } = data;
  const rows = attributeRows(entity.attributes);
  const root = useRef<HTMLDivElement>(null);
  const previousTops = useRef(new Map<string, number>());
  const flow = useReactFlow();
  const [preview, setPreview] = useState<{
    id: string;
    direction: "indent" | "outdent" | null;
    hint: string;
  } | null>(null);
  const gesture = useRef<{
    id: string;
    x: number;
    y: number;
    direction: "indent" | "outdent" | null;
  } | null>(null);
  const addField = () => {
    useERStore.getState().endTransaction();
    useERStore.getState().addAttribute(id);
    const added = useERStore.getState().attributeFocus?.attributeId;
    requestAnimationFrame(() => {
      const row = Array.from(
        root.current?.querySelectorAll<HTMLElement>("[data-row-id]") ?? [],
      ).find((el) => el.dataset.rowId === added);
      const input = row?.querySelector("textarea");
      if (notation !== "chen") {
        input?.focus();
        input?.select();
      }
    });
  };
  const nodeWidth = Math.min(
    680,
    Math.max(
      400,
      ...rows.map((r) => r.attribute.name.length * 7 + 155 + r.depth * 15),
      ...(data.foreignColumns ?? []).map((c) => c.name.length * 7 + 145),
    ),
  );
  useLayoutEffect(() => {
    const next = new Map<string, number>();
    root.current
      ?.querySelectorAll<HTMLElement>("[data-row-id]")
      .forEach((el) => {
        const key = el.dataset.rowId!;
        const top = el.offsetTop;
        next.set(key, top);
        const before = previousTops.current.get(key);
        if (
          before !== undefined &&
          before !== top &&
          !window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ) {
          el.getAnimations().forEach((a) => a.cancel());
          el.animate(
            [
              { transform: `translateY(${before - top}px)` },
              { transform: "translateY(0)" },
            ],
            { duration: 160, easing: "cubic-bezier(.2,.8,.2,1)" },
          );
        }
      });
    previousTops.current = next;
  }, [entity.attributes]);
  const selectedIds = useERStore((s) => s.selectedIds);
  const notation = useERStore((s) => s.notation);
  const update = useERStore((s) => s.updateAttribute);
  const begin = useERStore((s) => s.beginTransaction);
  const end = useERStore((s) => s.endTransaction);
  const internals = useUpdateNodeInternals();
  useEffect(() => {
    internals(id);
    const timer = setTimeout(() => internals(id), 180);
    return () => clearTimeout(timer);
  }, [id, entity.attributes, data.foreignColumns, notation, internals]);
  return (
    <div
      ref={root}
      className={`entity-node ${selected ? "is-selected" : ""} ${notation === "chen" ? "entity-chen" : ""} ${entity.type === "weak" ? "entity-weak" : ""}`}
      style={
        {
          "--entity-color": entity.color,
          width: data.layoutWidth ?? nodeWidth,
          height: data.layoutHeight,
        } as React.CSSProperties
      }
    >
      <NodeToolbar
        isVisible={selected}
        position={Position.Top}
        className="floating-actions"
      >
        <Button variant="ghost" size="sm" onClick={addField}>
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
      <ConnectionPorts nodeId={id} ports={data.ports} />
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
      {rows.map(({ attribute: a, index: i, depth, parentId }) => (
        <AttributeMenu
          key={a.id}
          ownerId={id}
          attributeId={a.id}
          hasChildren={!!a.compositeChildren?.length}
        >
          <div
            key={a.id}
            data-row-id={a.id}
            className={`attribute-row nodrag ${a.isDerived ? "derived" : ""} ${selectedIds.includes(a.id) ? "focused-attribute-row" : ""}`}
            style={{
              paddingLeft: Math.max(
                4,
                4 +
                  depth * 20 +
                  (preview?.id === a.id
                    ? preview.direction === "indent"
                      ? 20
                      : preview.direction === "outdent"
                        ? -20
                        : 0
                    : 0),
              ),
              ...(preview?.id === a.id
                ? { background: "var(--accent-soft)" }
                : {}),
            }}
            onClick={(e) => {
              e.stopPropagation();
              useERStore.getState().focusAttribute(id, a.id, e.shiftKey);
            }}
            onFocus={(e) => {
              if (
                !e.currentTarget.contains(e.relatedTarget) &&
                e.target.matches(":focus-visible")
              )
                useERStore.getState().focusAttribute(id, a.id, true);
            }}
          >
            <button
              className="attribute-grip nodrag"
              style={{ touchAction: "none" }}
              aria-label={`Move ${a.name}; drag right to nest, left to unnest; arrow keys also work`}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.setPointerCapture(e.pointerId);
                useERStore.getState().endTransaction();
                begin();
                gesture.current = {
                  id: a.id,
                  x: e.clientX,
                  y: e.clientY,
                  direction: null,
                };
              }}
              onPointerMove={(e) => {
                const g = gesture.current;
                if (!g) return;
                const dx = (e.clientX - g.x) / flow.getZoom();
                const owner = useERStore
                  .getState()
                  .graph.entities.find((n) => n.id === id)!;
                const current = attributeRows(owner.attributes).find(
                  (r) => r.attribute.id === g.id,
                )!;
                const siblings = attributeRows(owner.attributes).filter(
                  (r) => r.parentId === current.parentId,
                );
                const previous = siblings.find(
                  (r) => r.index === current.index - 1,
                );
                g.direction =
                  dx > 32 && previous
                    ? "indent"
                    : dx < -32 && current.parentId
                      ? "outdent"
                      : null;
                setPreview({
                  id: g.id,
                  direction: g.direction,
                  hint:
                    g.direction === "indent"
                      ? `Nest under ${previous!.attribute.name}`
                      : g.direction === "outdent"
                        ? "Move out one level"
                        : "Drag right to nest · left to unnest",
                });
                if (g.direction || Math.abs(dx) > 24) return;
                const target = Array.from(
                  root.current?.querySelectorAll<HTMLElement>(
                    "[data-row-id]",
                  ) ?? [],
                ).find((el) => {
                  const r = el.getBoundingClientRect();
                  return e.clientY >= r.top && e.clientY <= r.bottom;
                });
                const row = attributeRows(owner.attributes).find(
                  (r) => r.attribute.id === target?.dataset.rowId,
                );
                if (
                  row &&
                  row.parentId === current.parentId &&
                  row.index !== current.index
                )
                  useERStore.getState().reorderAttribute(id, g.id, row.index);
              }}
              onPointerUp={(e) => {
                const g = gesture.current;
                if (!g) return;
                e.stopPropagation();
                if (g.direction)
                  useERStore
                    .getState()
                    .changeAttributeDepth(id, g.id, g.direction);
                gesture.current = null;
                setPreview(null);
                end();
                e.currentTarget.releasePointerCapture(e.pointerId);
              }}
              onPointerCancel={() => {
                gesture.current = null;
                setPreview(null);
                end();
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                  e.preventDefault();
                  e.stopPropagation();
                  useERStore
                    .getState()
                    .changeAttributeDepth(
                      id,
                      a.id,
                      e.key === "ArrowRight" ? "indent" : "outdent",
                    );
                  return;
                }
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
            {preview?.id === a.id && (
              <span className="attribute-drag-hint">{preview.hint}</span>
            )}
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
            <textarea
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              }}
              rows={Math.max(
                1,
                Math.ceil(
                  a.name.length /
                    Math.max(
                      16,
                      Math.floor((nodeWidth - 165 - depth * 15) / 7),
                    ),
                ),
              )}
              className="nodrag attribute-name"
              aria-label={`${a.name} field name`}
              value={a.name}
              onFocus={begin}
              onBlur={end}
              onChange={(e) => update(id, a.id, { name: e.target.value })}
            />
            {a.compositeChildren?.length ? (
              <span className="attribute-type composite-badge">
                {(a.preset === "address" ? "address" : "composite") +
                  (a.isMultivalued ? "[]" : "")}
              </span>
            ) : (
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
            )}
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
        </AttributeMenu>
      ))}
      {data.foreignColumns?.map((c) => (
        <div
          className="attribute-row generated-column nodrag"
          key={`${c.sourceRelationshipId}:${c.generatedName}`}
          tabIndex={0}
          role="button"
          aria-label={`Edit foreign key ${c.name}`}
          onClick={(e) => {
            e.stopPropagation();
            useERStore
              .getState()
              .focusGenerated(
                id,
                `fk:${c.sourceRelationshipId ?? "inherited"}:${c.generatedName}`,
              );
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              useERStore
                .getState()
                .focusGenerated(
                  id,
                  `fk:${c.sourceRelationshipId ?? "inherited"}:${c.generatedName}`,
                );
            }
          }}
        >
          <span className="fk-badge">FK</span>
          <span className="attribute-name" title={c.name}>
            {c.name}
          </span>
          <span className="attribute-type">{c.type}</span>
        </div>
      ))}
      <footer className="entity-add-footer">
        <span>{rows.length} fields</span>
        <button
          className="nodrag"
          onClick={addField}
          aria-label="Add attribute"
        >
          <Plus size={14} /> Add attribute
        </button>
      </footer>
    </div>
  );
});
