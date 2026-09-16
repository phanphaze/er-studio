import type { Cardinality, Participation, RelationshipEndpoint } from "./types";
export const isMany = (p: Participation) => p.max === "*" || p.max > 1;
export const cardinalityFor = (
  endpoints: RelationshipEndpoint[],
): Cardinality => {
  const n = endpoints.filter((p) => isMany(p.participation)).length;
  return n > 1 ? "M:N" : n === 1 ? "1:N" : "1:1";
};
export const cardinalityLabel = (c: Cardinality) =>
  ({ "1:1": "One to one", "1:N": "One to many", "M:N": "Many to many" })[c];
export function participationLabel(p: Participation): string {
  if (p.max === 1)
    return p.min === 0 ? "Optional · zero or one" : "Required · exactly one";
  if (p.max === "*")
    return p.min === 0
      ? "Optional · zero or more"
      : p.min === 1
        ? "Required · one or more"
        : `Required · at least ${p.min}`;
  if (p.min === p.max) return `Required · exactly ${p.min}`;
  return `${p.min === 0 ? "Optional" : "Required"} · ${p.min} to ${p.max}`;
}

export function relationshipCardinality(
  endpoints: RelationshipEndpoint[],
): string {
  return endpoints
    .map((p) =>
      p.participation.max === "*"
        ? "many"
        : p.participation.max === 1
          ? "one"
          : String(p.participation.max),
    )
    .join(" to ");
}
export function totalParticipation(
  endpoints: RelationshipEndpoint[],
  index: number,
): boolean {
  const p = endpoints[index];
  if (p.entityParticipation) return p.entityParticipation === "total";
  return endpoints.length === 2
    ? endpoints[1 - index].participation.min > 0
    : false;
}
