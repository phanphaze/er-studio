"use client";
import { useMemo } from "react";
import { useERStore } from "@/store/useERStore";
import { canOwnWeakEntity } from "@/lib/ast/weakOwnership";
import { attributeRows } from "@/lib/ast/attributes";
import { compileGraph } from "@/lib/compiler/sqlGenerator";

export function WeakOwnershipPanel({ entityId }: { entityId: string }) {
  const graph = useERStore((s) => s.graph);
  const entity = graph.entities.find((e) => e.id === entityId)!;
  const links = graph.relationships.filter(
    (r) =>
      r.type === "identifying" &&
      r.ownerEntityId !== entityId &&
      r.endpoints.some((p) => p.entityId === entityId),
  );
  const ownerId = links.length === 1 ? (links[0].ownerEntityId ?? "") : "";
  const result = useMemo(() => compileGraph(graph), [graph]);
  const table = result.schema.tables.find((t) => t.name === entity.name);
  return (
    <section className="weak-ownership-panel">
      <h3>Weak entity ownership</h3>
      <label className="field-label">
        Owner entity
        <select
          value={ownerId}
          onChange={(event) =>
            useERStore.getState().setWeakOwner(entityId, event.target.value)
          }
        >
          <option value="" disabled>
            Choose an owner
          </option>
          {graph.entities
            .filter((e) => canOwnWeakEntity(graph, entityId, e.id))
            .map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
        </select>
      </label>
      <p>
        Each {entity.name} belongs to exactly one owner. Choosing an owner
        creates or updates its identifying relationship and sets total
        participation.
      </p>
      <h4>Partial keys</h4>
      <p>
        Select the fields that identify this record within its owner. Inherited
        owner keys are added automatically.
      </p>
      <div className="weak-partial-keys">
        {attributeRows(entity.attributes).map(({ attribute: a, depth }) => (
          <label key={a.id} style={{ paddingLeft: depth * 12 }}>
            <input
              type="checkbox"
              checked={a.isPartialKey}
              disabled={a.isDerived || a.isMultivalued}
              onChange={(event) =>
                useERStore
                  .getState()
                  .updateAttribute(entityId, a.id, {
                    isPartialKey: event.target.checked,
                    ...(event.target.checked
                      ? { isPrimaryKey: false, isNullable: false }
                      : {}),
                  })
              }
            />
            <span>{a.name}</span>
          </label>
        ))}
        {!entity.attributes.length && (
          <p>Add an attribute below to use as a partial key.</p>
        )}
      </div>
      <h4>Generated primary key</h4>
      <p>Owner primary key + partial keys</p>
      {table?.primaryKey.length ? (
        <code>{table.primaryKey.join(" + ")}</code>
      ) : (
        <p>
          Choose an owner with a primary key and mark the partial keys. Resolve
          validation errors to see the generated SQL key.
        </p>
      )}
      <p>
        No need to manually copy the owner’s fields. Composite owner keys are
        inherited in full.
      </p>
    </section>
  );
}
