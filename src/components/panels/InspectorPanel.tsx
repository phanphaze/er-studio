"use client";
import { useMemo } from "react";
import {
  SlidersHorizontal,
  ShieldCheck,
  Code2,
  Plus,
  Trash2,
  ArrowLeftRight,
  MousePointer2,
  AlertTriangle,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useERStore } from "@/store/useERStore";
import { compileGraph } from "@/lib/compiler/sqlGenerator";
import {
  DATA_TYPES,
  type Attribute,
  type DataType,
  type EntityType,
  type Relationship,
  type ReferentialAction,
} from "@/lib/ast/types";
import { SqlPreviewPanel } from "./SqlPreviewPanel";
function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
}) {
  return (
    <label className="field-label">
      {label}
      <input
        value={value}
        onFocus={() => useERStore.getState().beginTransaction()}
        onBlur={() => useERStore.getState().endTransaction()}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
function AttributeEditor({
  entityId,
  a,
  depth = 0,
}: {
  entityId: string;
  a: Attribute;
  depth?: number;
}) {
  const update = useERStore((s) => s.updateAttribute);
  return (
    <div className="attribute-editor" style={{ marginLeft: depth * 8 }}>
      <div className="attribute-editor-title">
        <strong>{a.name}</strong>
        <button
          aria-label={`Delete ${a.name}`}
          onClick={() => useERStore.getState().deleteAttribute(entityId, a.id)}
        >
          <Trash2 size={14} />
        </button>
      </div>
      <TextField
        label="Name"
        value={a.name}
        onChange={(name) => update(entityId, a.id, { name })}
      />
      <label className="field-label">
        Data type
        <select
          value={a.type}
          onChange={(e) =>
            update(entityId, a.id, { type: e.target.value as DataType })
          }
        >
          {DATA_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <div className="flag-grid">
        {(
          [
            ["isPrimaryKey", "Primary key"],
            ["isPartialKey", "Partial key"],
            ["isNullable", "Nullable"],
            ["isUnique", "Unique"],
            ["isDerived", "Derived"],
            ["isMultivalued", "Multivalued"],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={a[key]}
              disabled={
                (
                  ["isNullable", "isDerived", "isMultivalued"] as string[]
                ).includes(key) &&
                (a.isPrimaryKey || a.isPartialKey)
              }
              onChange={(e) =>
                update(entityId, a.id, { [key]: e.target.checked })
              }
            />
            {label}
          </label>
        ))}
      </div>
      {["integer", "bigint", "numeric(12,2)"].includes(a.type) && (
        <label className="field-label">
          Minimum value (CHECK)
          <input
            type="number"
            value={a.check?.value ?? ""}
            onChange={(e) =>
              update(entityId, a.id, {
                check:
                  e.target.value === ""
                    ? undefined
                    : { operator: ">=", value: Number(e.target.value) },
              })
            }
          />
        </label>
      )}
      {a.compositeChildren?.map((c) => (
        <AttributeEditor
          key={c.id}
          entityId={entityId}
          a={c}
          depth={depth + 1}
        />
      ))}
      <button
        className="text-action"
        onClick={() => useERStore.getState().addAttribute(entityId, a.id)}
      >
        + Composite child
      </button>
    </div>
  );
}
function RelationshipEditor({ r }: { r: Relationship }) {
  const update = (p: Partial<Relationship>) =>
    useERStore.getState().updateRelationship(r.id, p);
  return (
    <>
      <div className="panel-heading">
        <ArrowLeftRight size={18} />
        <strong>Relationship</strong>
      </div>
      <TextField
        label="Name"
        value={r.name}
        onChange={(name) => update({ name })}
      />
      <label className="field-label">
        Kind
        <select
          value={r.type}
          onChange={(e) =>
            update({ type: e.target.value as Relationship["type"] })
          }
        >
          {["non-identifying", "identifying", "recursive", "n-ary"].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      {r.type === "identifying" && (
        <label className="field-label">
          Owner
          <select
            value={r.ownerEntityId ?? ""}
            onChange={(e) => update({ ownerEntityId: e.target.value })}
          >
            <option value="">Select owner</option>
            {r.endpoints.map((p, i) => (
              <option key={i} value={p.entityId}>
                {
                  useERStore
                    .getState()
                    .graph.entities.find((e) => e.id === p.entityId)?.name
                }
              </option>
            ))}
          </select>
        </label>
      )}
      {r.endpoints.map((p, i) => (
        <div className="attribute-editor" key={i}>
          <strong>
            {
              useERStore
                .getState()
                .graph.entities.find((e) => e.id === p.entityId)?.name
            }
          </strong>
          <TextField
            label="Role"
            value={p.role}
            onChange={(role) =>
              update({
                endpoints: r.endpoints.map((p, j) =>
                  i === j ? { ...p, role } : p,
                ),
              })
            }
          />
          <label className="field-label">
            Participation
            <select
              value={`${p.participation.min}..${p.participation.max}`}
              onChange={(e) => {
                const [min, max] = e.target.value.split("..");
                const endpoints = r.endpoints.map((p, j) =>
                  i === j
                    ? {
                        ...p,
                        participation: {
                          min: Number(min) as 0 | 1,
                          max: max === "*" ? ("*" as const) : (1 as const),
                        },
                      }
                    : p,
                );
                const many = endpoints.filter(
                  (p) => p.participation.max === "*",
                ).length;
                update({
                  endpoints,
                  cardinality: many === 2 ? "M:N" : many === 1 ? "1:N" : "1:1",
                });
              }}
            >
              {["0..1", "1..1", "0..*", "1..*"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
        </div>
      ))}
      {r.type === "n-ary" && (
        <label className="field-label">
          Add participant
          <select
            value=""
            onChange={(e) => {
              if (e.target.value)
                update({
                  endpoints: [
                    ...r.endpoints,
                    {
                      entityId: e.target.value,
                      role: "role_" + (r.endpoints.length + 1),
                      participation: { min: 0, max: "*" },
                    },
                  ],
                });
            }}
          >
            <option value="">Select entity</option>
            {useERStore.getState().graph.entities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {r.cardinality === "1:1" && (
        <label className="field-label">
          Store foreign key on
          <select
            value={r.foreignKeyEndpoint ?? 1}
            onChange={(e) =>
              update({ foreignKeyEndpoint: Number(e.target.value) })
            }
          >
            {r.endpoints.map((p, i) => (
              <option key={i} value={i}>
                {p.role || p.entityId}
              </option>
            ))}
          </select>
        </label>
      )}
      {(["onDelete", "onUpdate"] as const).map((k) => (
        <label className="field-label" key={k}>
          {k === "onDelete" ? "On delete" : "On update"}
          <select
            value={r[k]}
            onChange={(e) =>
              update({ [k]: e.target.value as ReferentialAction })
            }
          >
            {["RESTRICT", "CASCADE", "NO ACTION", "SET NULL"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
      ))}
      <div className="section-heading">
        <strong>Relationship attributes</strong>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Add relationship attribute"
          onClick={() => useERStore.getState().addAttribute(r.id)}
        >
          <Plus size={16} />
        </Button>
      </div>
      {r.attributes.map((a) => (
        <AttributeEditor key={a.id} entityId={r.id} a={a} />
      ))}
      <Button
        variant="outline"
        onClick={() => useERStore.getState().invertCardinality(r.id)}
      >
        <ArrowLeftRight size={15} /> Invert cardinality
      </Button>
      <Button
        variant="ghost"
        onClick={() => useERStore.getState().deleteRelationship(r.id)}
      >
        <Trash2 size={15} /> Delete relationship
      </Button>
    </>
  );
}
export function InspectorPanel() {
  const graph = useERStore((s) => s.graph);
  const selection = useERStore((s) => s.selection);
  const result = useMemo(() => compileGraph(graph), [graph]);
  const e =
    selection?.kind === "entity"
      ? graph.entities.find((e) => e.id === selection.id)
      : undefined;
  const r =
    selection?.kind === "relationship"
      ? graph.relationships.find((e) => e.id === selection.id)
      : undefined;
  const spec =
    selection?.kind === "specialization"
      ? graph.specializations.find((e) => e.id === selection.id)
      : undefined;
  return (
    <aside className="inspector">
      <Tabs defaultValue="properties" className="inspector-tabs">
        <TabsList className="panel-tabs">
          <TabsTrigger value="properties">
            <SlidersHorizontal size={15} /> Properties
          </TabsTrigger>
          <TabsTrigger value="validation">
            <ShieldCheck size={15} />{" "}
            {result.issues.filter((i) => i.severity === "error").length ||
              "Checks"}
          </TabsTrigger>
          <TabsTrigger value="sql">
            <Code2 size={15} /> SQL
          </TabsTrigger>
        </TabsList>
        <TabsContent value="properties" className="panel-scroll">
          {e ? (
            <>
              <div className="panel-heading">
                <span className="entity-dot" style={{ background: e.color }} />
                <strong>Entity properties</strong>
              </div>
              <TextField
                label="Table name"
                value={e.name}
                onChange={(name) =>
                  useERStore.getState().updateEntity(e.id, { name })
                }
              />
              <label className="field-label">
                Entity type
                <select
                  value={e.type}
                  onChange={(event) =>
                    useERStore
                      .getState()
                      .updateEntity(e.id, {
                        type: event.target.value as EntityType,
                      })
                  }
                >
                  {["regular", "weak", "associative"].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <div className="color-picker">
                {["#a78bfa", "#60a5fa", "#34d399", "#fbbf24", "#f472b6"].map(
                  (color) => (
                    <button
                      key={color}
                      aria-label={`Set color ${color}`}
                      style={{ background: color }}
                      onClick={() =>
                        useERStore.getState().updateEntity(e.id, { color })
                      }
                    />
                  ),
                )}
              </div>
              <div className="section-heading">
                <strong>Attributes</strong>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Add attribute"
                  onClick={() => useERStore.getState().addAttribute(e.id)}
                >
                  <Plus size={16} />
                </Button>
              </div>
              {e.attributes.map((a) => (
                <AttributeEditor entityId={e.id} a={a} key={a.id} />
              ))}
            </>
          ) : r ? (
            <RelationshipEditor r={r} />
          ) : spec ? (
            <>
              <div className="panel-heading">
                <strong>{spec.name}</strong>
              </div>
              {(["strategy", "disjointness", "completeness"] as const).map(
                (k) => (
                  <label key={k} className="field-label">
                    {k}
                    <select
                      value={spec[k]}
                      onChange={(e) =>
                        useERStore
                          .getState()
                          .updateSpecialization(spec.id, {
                            [k]: e.target.value,
                          })
                      }
                    >
                      {(k === "strategy"
                        ? ["table-per-type", "table-per-hierarchy"]
                        : k === "disjointness"
                          ? ["disjoint", "overlapping"]
                          : ["total", "partial"]
                      ).map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                ),
              )}
              <Button
                variant="ghost"
                onClick={() =>
                  useERStore.getState().deleteSpecialization(spec.id)
                }
              >
                Delete specialization
              </Button>
            </>
          ) : (
            <div className="empty-panel">
              <div className="empty-icon">
                <MousePointer2 size={24} />
              </div>
              <h3>Every detail, in place.</h3>
              <p>Select an entity or relationship to edit its properties.</p>
              <div className="shortcut-list">
                <span>
                  Add entity <kbd>⌘ K</kbd>
                </span>
                <span>
                  Undo change <kbd>⌘ Z</kbd>
                </span>
                <span>
                  Pan canvas <kbd>Drag</kbd>
                </span>
              </div>
            </div>
          )}
        </TabsContent>
        <TabsContent value="validation" className="panel-scroll">
          <div className="panel-heading">
            <ShieldCheck size={18} />
            <strong>Model validation</strong>
          </div>
          {!result.issues.some((i) => i.severity === "error") && (
            <div className="validation-ok">
              Your schema is ready to compile.
            </div>
          )}
          {result.issues.map((i, index) => (
            <div key={index} className={`issue ${i.severity}`}>
              <AlertTriangle size={16} />
              <div>
                <strong>
                  {i.severity === "error"
                    ? "Needs attention"
                    : "Enforcement note"}
                </strong>
                <p>{i.message}</p>
              </div>
            </div>
          ))}
        </TabsContent>
        <TabsContent value="sql" className="sql-tab">
          <SqlPreviewPanel />
        </TabsContent>
      </Tabs>
    </aside>
  );
}
