import type { ERGraph, Relationship } from "./types";
import { cardinalityFor } from "./participation";

export function canOwnWeakEntity(
  graph: ERGraph,
  weakId: string,
  ownerId: string,
): boolean {
  if (weakId === ownerId || !graph.entities.some((e) => e.id === ownerId))
    return false;
  const seen = new Set<string>();
  const visit = (id: string): boolean => {
    if (id === weakId) return false;
    if (seen.has(id)) return true;
    seen.add(id);
    return graph.relationships
      .filter(
        (r) =>
          r.type === "identifying" &&
          r.ownerEntityId &&
          r.ownerEntityId !== id &&
          r.endpoints.some((p) => p.entityId === id),
      )
      .every((r) => visit(r.ownerEntityId!));
  };
  return visit(ownerId);
}

/** Configure ownership atomically without copying inherited columns into the ER model. */
export function assignWeakOwner(
  graph: ERGraph,
  weakId: string,
  ownerId: string,
) {
  const weak = graph.entities.find((e) => e.id === weakId);
  const owner = graph.entities.find((e) => e.id === ownerId);
  if (!weak || !owner || !canOwnWeakEntity(graph, weakId, ownerId)) return;
  const existing =
    graph.relationships.find(
      (r) =>
        r.endpoints.length === 2 &&
        r.endpoints.some((p) => p.entityId === weakId) &&
        r.endpoints.some((p) => p.entityId === ownerId) &&
        r.type === "identifying",
    ) ??
    graph.relationships.find(
      (r) =>
        r.endpoints.length === 2 &&
        r.type === "non-identifying" &&
        r.endpoints.some((p) => p.entityId === weakId) &&
        r.endpoints.some((p) => p.entityId === ownerId),
    );
  // Keep former links and their attributes, but remove their identifying role.
  for (const r of graph.relationships) {
    if (
      r !== existing &&
      r.type === "identifying" &&
      r.ownerEntityId !== weakId &&
      r.endpoints.some((p) => p.entityId === weakId)
    ) {
      r.type = "non-identifying";
      delete r.ownerEntityId;
    }
  }
  weak.type = "weak";
  const relation: Relationship = existing ?? {
    id: crypto.randomUUID(),
    name: `${owner.name}_owns_${weak.name}`,
    type: "identifying",
    cardinality: "1:N",
    attributes: [],
    endpoints: [
      { entityId: ownerId, role: "owner", participation: { min: 1, max: 1 } },
      {
        entityId: weakId,
        role: "dependent",
        participation: { min: 0, max: "*" },
      },
    ],
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  };
  relation.type = "identifying";
  relation.ownerEntityId = ownerId;
  relation.endpoints = relation.endpoints.map((p) =>
    p.entityId === ownerId
      ? {
          ...p,
          participation: { min: 1, max: 1 },
          entityParticipation:
            relation.endpoints.find((ep) => ep.entityId === weakId)!
              .participation.min > 0
              ? "total"
              : "partial",
        }
      : { ...p, entityParticipation: "total" },
  );
  relation.cardinality = cardinalityFor(relation.endpoints);
  if (relation.onDelete === "SET NULL") relation.onDelete = "CASCADE";
  if (relation.onUpdate === "SET NULL") relation.onUpdate = "CASCADE";
  if (!existing) graph.relationships.push(relation);
}
