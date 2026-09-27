"use client";
import { useState } from "react";
import { useERStore } from "@/store/useERStore";
import { isMany } from "@/lib/ast/participation";
import { Button } from "@/components/ui/button";
export function EntityMultiplicityPanel({ entityId }: { entityId: string }) {
  const graph = useERStore((s) => s.graph);
  const entity = graph.entities.find((e) => e.id === entityId)!;
  const [owner, setOwner] = useState("");
  const links = graph.relationships.flatMap((r) =>
    r.endpoints.flatMap((p, index) =>
      p.entityId === entityId ? [{ r, p, index }] : [],
    ),
  );
  return (
    <section className="entity-multiplicity">
      <div className="section-heading">
        <strong>Multiple records</strong>
      </div>
      <p className="muted">
        Allow several {entity.name} records for each related record—for example,
        multiple credit cards per customer.
      </p>
      {links.map(({ r, p, index }) => {
        const others = r.endpoints
          .filter((_, i) => i !== index)
          .map(
            (p) =>
              graph.entities.find((e) => e.id === p.entityId)?.name ?? p.role,
          )
          .join(" + ");
        return (
          <div className="multiplicity-link" key={r.id + "-" + index}>
            <label className="digits-check">
              <input
                type="checkbox"
                disabled={
                  r.type === "identifying" && r.ownerEntityId === entityId
                }
                checked={isMany(p.participation)}
                onChange={(e) =>
                  useERStore
                    .getState()
                    .setEntityMultiplicity(r.id, index, e.target.checked)
                }
              />
              Allow multiple {entity.name} per {others}
              {r.endpoints.length > 2 ? " combination" : ""}
            </label>
            <small>
              {isMany(p.participation)
                ? p.participation.max === "*"
                  ? "No upper limit"
                  : `At most ${p.participation.max}`
                : "At most one"}{" "}
              · {r.name}
            </small>
            <button
              className="multiplicity-details"
              onClick={() =>
                useERStore
                  .getState()
                  .setSelection({ kind: "relationship", id: r.id })
              }
            >
              Edit minimum / maximum
            </button>
          </div>
        );
      })}
      <label className="field-label">
        Add a one-to-many relationship from
        <select value={owner} onChange={(e) => setOwner(e.target.value)}>
          <option value="">Choose the owner (e.g. Customer)</option>
          {graph.entities
            .filter((e) => e.id !== entityId)
            .map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
        </select>
      </label>
      <Button
        variant="outline"
        size="sm"
        disabled={!owner}
        onClick={() => {
          const parent = graph.entities.find((e) => e.id === owner);
          if (!parent) return;
          const base = `${parent.name}_${entity.name}`.slice(0, 48);
          let name = base,
            i = 2;
          while (graph.relationships.some((r) => r.name === name))
            name = base + "_" + i++;
          useERStore.getState().addRelationship({
            name,
            type: "non-identifying",
            cardinality: "1:N",
            endpoints: [
              {
                entityId: parent.id,
                role: "owner",
                participation: { min: 1, max: 1 },
                entityParticipation: "partial",
              },
              {
                entityId,
                role: "record",
                participation: { min: 0, max: "*" },
                entityParticipation: "total",
              },
            ],
            attributes: [],
            onDelete: "RESTRICT",
            onUpdate: "CASCADE",
          });
          setOwner("");
        }}
      >
        Allow multiple {entity.name}
      </Button>
    </section>
  );
}
