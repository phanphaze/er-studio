"use client";
import type { NodeProps } from "@xyflow/react";
import { useERStore } from "@/store/useERStore";
export function EntitySetNode({ id, data, selected }: NodeProps) {
  return (
    <div className={`entity-set ${selected ? "is-selected" : ""}`}>
      <header className="set-drag">
        <span>ENTITY SET</span>
        <input
          className="nodrag"
          aria-label="Entity set name"
          value={String(data.label)}
          onChange={(e) =>
            useERStore.getState().commit((g) => {
              const s = g.entitySets?.find((s) => s.id === id);
              if (s) s.name = e.target.value;
            })
          }
        />
        <button
          className="nodrag"
          title="Ungroup — keep all contents"
          onClick={() =>
            useERStore.getState().commit((g) => {
              g.entitySets = g.entitySets?.filter((s) => s.id !== id);
            })
          }
        >
          Ungroup
        </button>
      </header>
    </div>
  );
}
