"use client";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { produce } from "immer";
import type {
  Attribute,
  Entity,
  ERGraph,
  Notation,
  Point,
  Relationship,
  Selection,
  Specialization,
} from "@/lib/ast/types";
import { attribute, seedGraph } from "./seed";
import { attributeRows, attributeSiblings } from "@/lib/ast/attributes";
export interface ERState {
  addAddress: (ownerId: string) => void;
  focusGenerated: (ownerId: string, key: string) => void;
  attributeFocus: {
    ownerId: string;
    attributeId: string;
    request: number;
    generated?: boolean;
  } | null;
  focusAttribute: (ownerId: string, attributeId: string) => void;
  graph: ERGraph;
  past: ERGraph[];
  future: ERGraph[];
  selection: Selection;
  notation: Notation;
  transactionBase: ERGraph | null;
  commit: (change: (g: ERGraph) => void) => void;
  beginTransaction: () => void;
  endTransaction: () => void;
  addEntity: (name?: string, position?: Point) => string;
  updateEntity: (
    id: string,
    patch: Partial<Omit<Entity, "id" | "attributes">>,
  ) => void;
  deleteEntity: (id: string) => void;
  duplicateEntity: (id: string) => void;
  addAttribute: (entityId: string, parentId?: string) => void;
  updateAttribute: (
    entityId: string,
    id: string,
    patch: Partial<Omit<Attribute, "id" | "compositeChildren">>,
  ) => void;
  deleteAttribute: (entityId: string, id: string) => void;
  reorderAttribute: (entityId: string, id: string, to: number) => void;
  addRelationship: (relationship: Omit<Relationship, "id">) => string;
  updateRelationship: (
    id: string,
    patch: Partial<Omit<Relationship, "id">>,
  ) => void;
  deleteRelationship: (id: string) => void;
  invertCardinality: (id: string) => void;
  addSpecialization: (s: Omit<Specialization, "id">) => void;
  updateSpecialization: (
    id: string,
    patch: Partial<Omit<Specialization, "id">>,
  ) => void;
  deleteSpecialization: (id: string) => void;
  setSelection: (selection: Selection) => void;
  setNotation: (notation: Notation) => void;
  moveEntities: (positions: { id: string; position: Point }[]) => void;
  undo: () => void;
  redo: () => void;
  replaceGraph: (graph: ERGraph) => void;
}
const findAttribute = (
  attrs: Attribute[],
  id: string,
): Attribute | undefined => {
  for (const a of attrs) {
    if (a.id === id) return a;
    const found = findAttribute(a.compositeChildren ?? [], id);
    if (found) return found;
  }
};
const removeAttribute = (attrs: Attribute[], id: string): void => {
  const i = attrs.findIndex((a) => a.id === id);
  if (i >= 0) attrs.splice(i, 1);
  else attrs.forEach((a) => removeAttribute(a.compositeChildren ?? [], id));
};
const cloneAttributes = (attrs: Attribute[]): Attribute[] =>
  attrs.map((a) => ({
    ...a,
    id: crypto.randomUUID(),
    compositeChildren: a.compositeChildren
      ? cloneAttributes(a.compositeChildren)
      : undefined,
  }));
const cleanSelection = (s: ERState) => {
  if (s.attributeFocus) {
    const owner = [...s.graph.entities, ...s.graph.relationships].find(
      (e) => e.id === s.attributeFocus!.ownerId,
    );
    if (
      !owner ||
      (!s.attributeFocus.generated &&
        !findAttribute(owner.attributes, s.attributeFocus.attributeId))
    )
      s.attributeFocus = null;
  }
  if (!s.selection) return;
  const list =
    s.selection.kind === "entity"
      ? s.graph.entities
      : s.selection.kind === "relationship"
        ? s.graph.relationships
        : s.graph.specializations;
  if (!list.some((e) => e.id === s.selection!.id)) s.selection = null;
};
/** Only AST mutations enter history. A drag/focused field is one transaction;
 * selection, viewport and renderer preference never destroy redo history. */
export const useERStore = create<ERState>()(
  immer((set, get) => ({
    addAddress: (ownerId) => {
      const id = crypto.randomUUID();
      get().commit((g) => {
        const owner =
          g.entities.find((e) => e.id === ownerId) ??
          g.relationships.find((r) => r.id === ownerId);
        if (!owner) return;
        let name = "address",
          i = 2;
        while (owner.attributes.some((a) => a.name === name))
          name = "address_" + i++;
        owner.attributes.push({
          ...attribute(id, name),
          preset: "address",
          compositeChildren: [
            "street",
            "address_line_2",
            "city",
            "state",
            "postal_code",
            "country",
          ].map((name) => ({
            ...attribute(crypto.randomUUID(), name),
            isNullable: ["address_line_2", "state"].includes(name),
          })),
        });
      });
      get().focusAttribute(ownerId, id);
    },
    focusGenerated: (ownerId, key) =>
      set((s) => {
        s.selection = { kind: "entity", id: ownerId };
        s.attributeFocus = {
          ownerId,
          attributeId: key,
          generated: true,
          request: (s.attributeFocus?.request ?? 0) + 1,
        };
      }),
    attributeFocus: null,
    focusAttribute: (ownerId, attributeId) => {
      const owner =
        get().graph.entities.find((e) => e.id === ownerId) ??
        get().graph.relationships.find((r) => r.id === ownerId);
      if (!owner || !findAttribute(owner.attributes, attributeId)) return;
      set((s) => {
        s.selection = {
          kind: s.graph.entities.some((e) => e.id === ownerId)
            ? "entity"
            : "relationship",
          id: ownerId,
        };
        s.attributeFocus = {
          ownerId,
          attributeId,
          request: (s.attributeFocus?.request ?? 0) + 1,
        };
      });
    },
    graph: seedGraph,
    past: [],
    future: [],
    selection: null,
    notation: "crows-foot",
    transactionBase: null,
    commit: (change) => {
      const before = get().graph;
      const next = produce(before, change);
      if (next === before) return;
      set((s) => {
        if (!s.transactionBase) {
          s.past.push(before);
          s.future = [];
        }
        s.graph = next;
        cleanSelection(s);
      });
    },
    beginTransaction: () => {
      if (!get().transactionBase)
        set((s) => {
          s.transactionBase = s.graph;
        });
    },
    endTransaction: () => {
      const base = get().transactionBase;
      const changed = base !== null && base !== get().graph;
      set((s) => {
        if (changed && base) {
          s.past.push(base);
          s.future = [];
        }
        s.transactionBase = null;
      });
    },
    addEntity: (name = "untitled", position) => {
      const id = crypto.randomUUID();
      get().commit((g) => {
        let n = name.trim() || "untitled";
        let i = 2;
        while (g.entities.some((e) => e.name === n)) n = `${name}_${i++}`;
        g.entities.push({
          id,
          name: n,
          type: "regular",
          color: "#a78bfa",
          position: position ?? {
            x: 180 + g.entities.length * 45,
            y: 140 + g.entities.length * 35,
          },
          attributes: [attribute(crypto.randomUUID(), "id", "uuid", true)],
        });
      });
      get().setSelection({ kind: "entity", id });
      return id;
    },
    updateEntity: (id, patch) =>
      get().commit((g) => {
        const e = g.entities.find((e) => e.id === id);
        if (e) Object.assign(e, patch);
      }),
    deleteEntity: (id) =>
      get().commit((g) => {
        g.entities = g.entities.filter((e) => e.id !== id);
        g.relationships = g.relationships.filter(
          (r) => !r.endpoints.some((p) => p.entityId === id),
        );
        g.specializations = g.specializations
          .filter((s) => s.superclassId !== id)
          .map((s) => ({
            ...s,
            subclassIds: s.subclassIds.filter((c) => c !== id),
          }))
          .filter((s) => s.subclassIds.length);
      }),
    duplicateEntity: (id) => {
      const e = get().graph.entities.find((e) => e.id === id);
      if (!e) return;
      const newId = crypto.randomUUID();
      get().commit((g) => {
        let name = e.name + "_copy";
        let i = 2;
        while (g.entities.some((t) => t.name === name))
          name = e.name + "_copy_" + i++;
        g.entities.push({
          ...e,
          id: newId,
          name,
          position: { x: e.position.x + 60, y: e.position.y + 60 },
          attributes: cloneAttributes(e.attributes),
        });
      });
      get().setSelection({ kind: "entity", id: newId });
    },
    addAttribute: (entityId, parentId) =>
      get().commit((g) => {
        const e =
          g.entities.find((e) => e.id === entityId) ??
          g.relationships.find((r) => r.id === entityId);
        if (!e) return;
        const parent = parentId
          ? findAttribute(e.attributes, parentId)
          : undefined;
        if (parent) {
          delete parent.minLength;
          delete parent.maxLength;
          delete parent.digitsOnly;
        }
        const list = parent ? (parent.compositeChildren ??= []) : e.attributes;
        let name = "column";
        let i = 2;
        while (list.some((a) => a.name === name)) name = "column_" + i++;
        list.push(attribute(crypto.randomUUID(), name));
      }),
    updateAttribute: (entityId, id, patch) =>
      get().commit((g) => {
        const e =
          g.entities.find((e) => e.id === entityId) ??
          g.relationships.find((r) => r.id === entityId);
        const a = e && findAttribute(e.attributes, id);
        if (a) {
          Object.assign(a, patch);
          if (patch.type && !["text", "varchar(255)"].includes(patch.type)) {
            delete a.minLength;
            delete a.maxLength;
            delete a.digitsOnly;
          }
          if (a.isPrimaryKey || a.isPartialKey) {
            a.isNullable = false;
            a.isDerived = false;
            a.isMultivalued = false;
          }
        }
      }),
    deleteAttribute: (entityId, id) =>
      get().commit((g) => {
        const e =
          g.entities.find((e) => e.id === entityId) ??
          g.relationships.find((r) => r.id === entityId);
        const removed = e && findAttribute(e.attributes, id);
        const removedIds = new Set(
          removed
            ? attributeRows([removed]).map((row) => row.attribute.id)
            : [],
        );
        if (e) removeAttribute(e.attributes, id);
        for (const r of g.relationships)
          for (const p of r.endpoints)
            if (p.attributeId && removedIds.has(p.attributeId))
              delete p.attributeId;
      }),
    reorderAttribute: (entityId, id, to) =>
      get().commit((g) => {
        const owner =
          g.entities.find((e) => e.id === entityId) ??
          g.relationships.find((r) => r.id === entityId);
        const attrs = owner && attributeSiblings(owner.attributes, id);
        if (!attrs) return;
        const from = attrs.findIndex((a) => a.id === id);
        if (from < 0 || to < 0 || to >= attrs.length || from === to) return;
        const [a] = attrs.splice(from, 1);
        attrs.splice(to, 0, a);
      }),
    addRelationship: (r) => {
      const id = crypto.randomUUID();
      get().commit((g) => {
        g.relationships.push({ ...r, id });
      });
      get().setSelection({ kind: "relationship", id });
      return id;
    },
    updateRelationship: (id, patch) =>
      get().commit((g) => {
        const r = g.relationships.find((r) => r.id === id);
        if (r) Object.assign(r, patch);
      }),
    deleteRelationship: (id) =>
      get().commit((g) => {
        g.relationships = g.relationships.filter((r) => r.id !== id);
      }),
    invertCardinality: (id) =>
      get().commit((g) => {
        const r = g.relationships.find((r) => r.id === id);
        if (r?.endpoints.length === 2) {
          [r.endpoints[0].participation, r.endpoints[1].participation] = [
            r.endpoints[1].participation,
            r.endpoints[0].participation,
          ];
          if (r.cardinality === "1:1")
            r.foreignKeyEndpoint = 1 - (r.foreignKeyEndpoint ?? 1);
        }
      }),
    addSpecialization: (s) =>
      get().commit((g) => {
        g.specializations.push({ ...s, id: crypto.randomUUID() });
      }),
    updateSpecialization: (id, patch) =>
      get().commit((g) => {
        const s = g.specializations.find((s) => s.id === id);
        if (s) Object.assign(s, patch);
      }),
    deleteSpecialization: (id) =>
      get().commit((g) => {
        g.specializations = g.specializations.filter((s) => s.id !== id);
      }),
    setSelection: (selection) => set({ selection, attributeFocus: null }),
    setNotation: (notation) => set({ notation }),
    moveEntities: (positions) =>
      get().commit((g) => {
        for (const { id, position } of positions) {
          const e =
            g.entities.find((e) => e.id === id) ??
            g.specializations.find((e) => e.id === id) ??
            g.relationships.find((e) => e.id === id);
          if (e) e.position = position;
        }
      }),
    undo: () => {
      get().endTransaction();
      set((s) => {
        const previous = s.past.pop();
        if (previous) {
          s.future.push(s.graph);
          s.graph = previous;
          cleanSelection(s);
        }
      });
    },
    redo: () => {
      get().endTransaction();
      set((s) => {
        const next = s.future.pop();
        if (next) {
          s.past.push(s.graph);
          s.graph = next;
          cleanSelection(s);
        }
      });
    },
    replaceGraph: (graph) => {
      get().endTransaction();
      get().commit((g) => {
        Object.assign(g, graph);
      });
      get().setSelection(null);
    },
  })),
);
