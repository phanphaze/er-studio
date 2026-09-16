import type { ERGraph } from "./types";
import { attributeRows } from "./attributes";
/** Entity sets aggregate a relationship and its participants without merging their tables. */
export function expandItems(g: ERGraph, ids: string[]): string[] {
  const result = new Set(ids);
  for (const set of g.entitySets ?? [])
    if (result.has(set.id)) {
      set.entityIds.forEach((id) => result.add(id));
      result.add(set.relationshipId);
    }
  for (const r of g.relationships)
    if (r.endpoints.every((p) => result.has(p.entityId))) result.add(r.id);
  for (const owner of [...g.entities, ...g.relationships])
    if (result.has(owner.id))
      attributeRows(owner.attributes).forEach((a) =>
        result.add(a.attribute.id),
      );
  return [...result];
}
export function deleteItems(g: ERGraph, ids: string[]) {
  const all = new Set(expandItems(g, ids));
  g.entities = g.entities.filter((e) => !all.has(e.id));
  g.relationships = g.relationships.filter(
    (r) => !all.has(r.id) && r.endpoints.every((p) => !all.has(p.entityId)),
  );
  g.relationships.forEach((r) =>
    r.endpoints.forEach((p) => {
      if (p.attributeId && all.has(p.attributeId)) delete p.attributeId;
    }),
  );
  g.specializations = g.specializations
    .filter((s) => !all.has(s.id) && !all.has(s.superclassId))
    .map((s) => ({
      ...s,
      subclassIds: s.subclassIds.filter((id) => !all.has(id)),
    }))
    .filter((s) => s.subclassIds.length);
  for (const owner of [...g.entities, ...g.relationships]) {
    const remove = (attrs: typeof owner.attributes): typeof owner.attributes =>
      attrs
        .filter((a) => !all.has(a.id))
        .map((a) => ({
          ...a,
          compositeChildren: a.compositeChildren
            ? remove(a.compositeChildren)
            : undefined,
        }));
    owner.attributes = remove(owner.attributes);
  }
  if (g.entitySets)
    g.entitySets = g.entitySets.filter(
      (s) =>
        !all.has(s.id) &&
        g.relationships.some((r) => r.id === s.relationshipId) &&
        s.entityIds.every((id) => g.entities.some((e) => e.id === id)),
    );
  for (const layout of Object.values(g.layouts ?? {}))
    for (const id of all) delete layout[id];
}
