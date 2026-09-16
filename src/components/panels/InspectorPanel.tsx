"use client";
import {
  cardinalityFor,
  cardinalityLabel,
  participationLabel,
} from "@/lib/ast/participation";
import { useMemo, useEffect, useState } from "react";
import {
  SlidersHorizontal,
  Settings2,
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
  type Participation,
  type ReferentialAction,
  type RelationalColumn,
} from "@/lib/ast/types";
import {
  relationshipCardinality,
  totalParticipation,
} from "@/lib/ast/participation";
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
  const focused = useERStore((s) => s.attributeFocus?.attributeId === a.id);
  return (
    <div
      data-attribute-editor={a.id}
      className={`attribute-editor ${focused ? "focused-attribute-editor" : ""}`}
      style={{ marginLeft: depth * 8 }}
    >
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
      {a.compositeChildren?.length ? (
        <p className="muted">
          {a.preset === "address" ? "Address" : "Composite"} structure · Edit
          the child fields below.
        </p>
      ) : (
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
      )}
      {!a.compositeChildren?.length &&
        ["text", "varchar(255)"].includes(a.type) && (
          <div className="length-controls">
            <div className="field-label">
              Length limits{" "}
              <small>Set both to the same number for an exact length.</small>
            </div>
            <div className="length-grid">
              {(["minLength", "maxLength"] as const).map((key) => (
                <label className="field-label" key={key}>
                  {key === "minLength" ? "Minimum" : "Maximum"}
                  <input
                    type="number"
                    min={0}
                    max={a.type === "varchar(255)" ? 255 : 1000000}
                    step={1}
                    value={a[key] ?? ""}
                    onChange={(e) =>
                      update(entityId, a.id, {
                        [key]:
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <label className="digits-check">
              <input
                type="checkbox"
                checked={a.digitsOnly ?? false}
                onChange={(e) =>
                  update(entityId, a.id, { digitsOnly: e.target.checked })
                }
              />
              Digits only (0–9)
            </label>
          </div>
        )}
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
function GeneratedFieldEditor({
  column,
  ownerId,
}: {
  column: RelationalColumn;
  ownerId: string;
}) {
  const relationship = useERStore((s) =>
    s.graph.relationships.find((r) => r.id === column.sourceRelationshipId),
  );
  const key = `fk:${column.sourceRelationshipId ?? "inherited"}:${column.generatedName}`;
  const focused = useERStore((s) => s.attributeFocus?.attributeId === key);
  const [name, setName] = useState(column.name);
  const [renameError, setRenameError] = useState("");
  useEffect(() => setName(column.name), [column.name]);
  return (
    <div
      data-attribute-editor={key}
      className={`attribute-editor ${focused ? "focused-attribute-editor" : ""}`}
    >
      <div className="attribute-editor-title">
        <strong>FK · {column.name}</strong>
      </div>
      {relationship ? (
        <label className="field-label">
          Column name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              if (!name.trim() || name === column.name) {
                setName(column.name);
                setRenameError("");
                return;
              }
              const foreignKeyNames = {
                ...relationship.foreignKeyNames,
                [column.generatedName!]: name.trim(),
              };
              const candidate = structuredClone(useERStore.getState().graph);
              candidate.relationships.find(
                (r) => r.id === relationship.id,
              )!.foreignKeyNames = foreignKeyNames;
              const error = compileGraph(candidate).issues.find(
                (i) => i.severity === "error",
              );
              if (error) {
                setRenameError(error.message);
                return;
              }
              setRenameError("");
              useERStore
                .getState()
                .updateRelationship(relationship.id, { foreignKeyNames });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
          />
        </label>
      ) : (
        <p>{column.name}</p>
      )}
      {renameError && (
        <p role="alert" className="muted">
          {renameError}
        </p>
      )}
      <p className="muted">
        {column.type} · {column.nullable ? "Nullable" : "Required"}. Type
        follows the referenced key.
      </p>
      {relationship ? (
        <>
          <p className="muted">
            Generated by {relationship.name}. Nullability and referential
            actions are controlled by this relationship.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              useERStore
                .getState()
                .setSelection({ kind: "relationship", id: relationship.id })
            }
          >
            Edit relationship
          </Button>
        </>
      ) : (
        <p className="muted">
          Inherited from the parent key. Edit the parent entity or
          specialization to change this field.
        </p>
      )}
    </div>
  );
}
function ParticipationControl({
  value,
  onChange,
}: {
  value: Participation;
  onChange: (p: Participation) => void;
}) {
  const preset =
    value.min <= 1 && (value.max === 1 || value.max === "*")
      ? `${value.min}:${value.max}`
      : "custom";
  return (
    <>
      <label className="field-label">
        Allowed count for this combination
        <select
          value={preset}
          onChange={(e) => {
            if (e.target.value === "custom") onChange({ min: 0, max: 5 });
            else {
              const [min, max] = e.target.value.split(":");
              onChange({
                min: Number(min),
                max: max === "*" ? "*" : Number(max),
              });
            }
          }}
        >
          <option value="0:1">Optional — zero or one</option>
          <option value="1:1">Mandatory — exactly one</option>
          <option value="0:*">Optional — zero or many</option>
          <option value="1:*">Mandatory — one or many</option>
          <option value="custom">Custom participant limits</option>
        </select>
      </label>
      <div className="length-grid">
        <label className="field-label">
          At least
          <input
            type="number"
            min={0}
            max={value.max === "*" ? 1000000 : value.max}
            value={value.min}
            onChange={(e) =>
              onChange({
                ...value,
                min: Math.max(0, Math.min(1000000, Number(e.target.value))),
                max:
                  typeof value.max === "number"
                    ? Math.max(value.max, Number(e.target.value))
                    : "*",
              })
            }
          />
        </label>
        <label className="field-label">
          At most
          <input
            type="number"
            min={Math.max(1, value.min)}
            max={1000000}
            disabled={value.max === "*"}
            value={value.max === "*" ? "" : value.max}
            placeholder="Unlimited"
            onChange={(e) =>
              onChange({
                ...value,
                max: Math.max(
                  1,
                  value.min,
                  Math.min(1000000, Number(e.target.value)),
                ),
              })
            }
          />
        </label>
      </div>
      <label className="digits-check">
        <input
          type="checkbox"
          checked={value.max === "*"}
          onChange={(e) =>
            onChange({
              ...value,
              max: e.target.checked ? "*" : Math.max(1, value.min),
            })
          }
        />
        No upper limit
      </label>
      <p className="participation-summary">{participationLabel(value)}</p>
    </>
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

            <div className="cardinality-summary">
              {relationshipCardinality(r.endpoints)}
            </div>
            {r.endpoints.length > 2 && (
              <p className="muted">
                Each limit applies to one fixed combination of all other
                participants, not a pairwise relationship.
              </p>
            )}
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
      <div className="cardinality-summary">
        {relationshipCardinality(r.endpoints)}
      </div>
      {r.endpoints.length > 2 && (
        <p className="muted">
          Each limit applies to one fixed combination of all other participants,
          not a pairwise relationship.
        </p>
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
          <p className="muted">
            For each fixed combination of{" "}
            {r.endpoints
              .filter((_, j) => j !== i)
              .map(
                (p) =>
                  useERStore
                    .getState()
                    .graph.entities.find((e) => e.id === p.entityId)?.name ??
                  p.role,
              )
              .join(" + ")}
            , how many{" "}
            {
              useERStore
                .getState()
                .graph.entities.find((e) => e.id === p.entityId)?.name
            }{" "}
            may participate?
          </p>
          <label className="field-label">
            Entity participation
            <select
              value={totalParticipation(r.endpoints, i) ? "total" : "partial"}
              onChange={(e) => {
                const total = e.target.value === "total";
                update({
                  endpoints: r.endpoints.map((ep, j) =>
                    j === i
                      ? {
                          ...ep,
                          entityParticipation: total ? "total" : "partial",
                        }
                      : r.endpoints.length === 2
                        ? {
                            ...ep,
                            participation: {
                              ...ep.participation,
                              min: total
                                ? Math.max(1, ep.participation.min)
                                : 0,
                            },
                          }
                        : ep,
                  ),
                });
              }}
            >
              <option value="partial">
                Partial — an entity may have no relationship (single line)
              </option>
              <option value="total">
                Total — every entity must participate (double line)
              </option>
            </select>
          </label>
          <ParticipationControl
            value={p.participation}
            onChange={(participation) => {
              const endpoints = r.endpoints.map((endpoint, j) =>
                j === i ? { ...endpoint, participation } : endpoint,
              );
              update({ endpoints, cardinality: cardinalityFor(endpoints) });
            }}
          />
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
            <div className="cardinality-summary">
              {relationshipCardinality(r.endpoints)}
            </div>
            {r.endpoints.length > 2 && (
              <p className="muted">
                Each limit applies to one fixed combination of all other
                participants, not a pairwise relationship.
              </p>
            )}
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
        disabled={r.endpoints.length !== 2}
        title={
          r.endpoints.length !== 2
            ? "Edit each participant independently for ternary relationships"
            : "Swap the two endpoint limits"
        }
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
  const focused = useERStore((s) => s.attributeFocus);
  const [tab, setTab] = useState("properties");
  useEffect(() => {
    if (focused) setTab("properties");
  }, [focused]);
  useEffect(() => {
    if (!focused || tab !== "properties") return;
    const frame = requestAnimationFrame(() => {
      const target = Array.from(
        document.querySelectorAll<HTMLElement>("[data-attribute-editor]"),
      ).find((el) => el.dataset.attributeEditor === focused.attributeId);
      const panel = target?.closest<HTMLElement>(".panel-scroll");
      if (target && panel) {
        const top =
          target.getBoundingClientRect().top -
          panel.getBoundingClientRect().top +
          panel.scrollTop -
          12;
        panel.scrollTo({
          top,
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "instant"
            : "smooth",
        });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [focused, tab]);
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
      <Tabs value={tab} onValueChange={setTab} className="inspector-tabs">
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
                    useERStore.getState().updateEntity(e.id, {
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => useERStore.getState().addAddress(e.id)}
              >
                + Address field
              </Button>
              {e.attributes.map((a) => (
                <AttributeEditor entityId={e.id} a={a} key={a.id} />
              ))}

              {result.schema.tables
                .find((t) => t.name === e.name)
                ?.columns.filter((c) => !c.sourceAttributeId && !c.internal)
                .map((c) => (
                  <GeneratedFieldEditor
                    ownerId={e.id}
                    key={`${c.sourceRelationshipId}:${c.generatedName}`}
                    column={c}
                  />
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
                        useERStore.getState().updateSpecialization(spec.id, {
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
