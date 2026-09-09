import {
  DATA_TYPES,
  type Attribute,
  type ERGraph,
  type ValidationIssue,
} from "./types";
export function validateGraph(g: ERGraph): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ids = new Set<string>();
  const error = (code: string, message: string, elementId?: string) =>
    issues.push({ severity: "error", code, message, elementId });
  const unique = (id: string) => {
    if (ids.has(id)) error("DUPLICATE_ID", `Duplicate identifier ${id}`, id);
    ids.add(id);
  };
  const name = (n: string, id: string) => {
    if (
      !n.trim() ||
      new TextEncoder().encode(n).length > 63 ||
      n.includes("\0")
    )
      error(
        "NAME",
        "Names must contain 1–63 UTF-8 bytes and no null characters.",
        id,
      );
  };
  const attrs = (as: Attribute[], owner: string) => {
    const names = new Set<string>();
    for (const a of as) {
      unique(a.id);
      name(a.name, a.id);
      if (names.has(a.name))
        error("DUPLICATE_ATTRIBUTE", `Duplicate attribute ${a.name}`, owner);
      names.add(a.name);
      if (!DATA_TYPES.includes(a.type))
        error("TYPE", `Unsupported type ${a.type}`, a.id);
      if (
        (a.isPrimaryKey || a.isPartialKey) &&
        (a.isNullable || a.isDerived || a.isMultivalued)
      )
        error(
          "KEY_FLAGS",
          `Key ${a.name} must be stored, scalar and required.`,
          owner,
        );
      if (a.check && !Number.isFinite(a.check.value))
        error("CHECK", "Check value must be finite.", a.id);
      for (const limit of [a.minLength, a.maxLength])
        if (
          limit !== undefined &&
          (!Number.isInteger(limit) || limit < 0 || limit > 1000000)
        )
          error(
            "LENGTH",
            "Length limits must be integers between 0 and 1,000,000.",
            a.id,
          );
      if (
        a.minLength !== undefined &&
        a.maxLength !== undefined &&
        a.minLength > a.maxLength
      )
        error("LENGTH", "Minimum length cannot exceed maximum length.", a.id);
      if (
        (a.minLength !== undefined ||
          a.maxLength !== undefined ||
          a.digitsOnly) &&
        !["text", "varchar(255)"].includes(a.type)
      )
        error(
          "LENGTH_TYPE",
          "Character and digit limits require text or varchar fields.",
          a.id,
        );
      if (
        a.compositeChildren?.length &&
        (a.minLength !== undefined || a.maxLength !== undefined || a.digitsOnly)
      )
        error(
          "COMPOSITE_LENGTH",
          "Set length limits on individual composite children.",
          a.id,
        );
      if (
        a.type === "varchar(255)" &&
        ((a.minLength ?? 0) > 255 || (a.maxLength ?? 0) > 255)
      )
        error(
          "LENGTH",
          "varchar(255) supports at most 255 characters; use text for larger limits.",
          a.id,
        );
      if (a.compositeChildren) attrs(a.compositeChildren, owner);
    }
  };
  const names = new Set<string>();
  for (const e of g.entities) {
    unique(e.id);
    name(e.name, e.id);
    if (names.has(e.name))
      error("DUPLICATE_ENTITY", `Duplicate entity ${e.name}`, e.id);
    names.add(e.name);
    attrs(e.attributes, e.id);
    if (e.type === "weak") {
      if (!e.attributes.some((a) => a.isPartialKey))
        error("PARTIAL_KEY", `${e.name} needs a partial key.`, e.id);
      if (
        g.relationships.filter(
          (r) =>
            r.type === "identifying" &&
            r.ownerEntityId !== e.id &&
            r.endpoints.some((p) => p.entityId === e.id),
        ).length !== 1
      )
        error("OWNER", `${e.name} needs exactly one identifying owner.`, e.id);
    } else if (
      !e.attributes.some((a) => a.isPrimaryKey) &&
      !g.specializations.some((s) => s.subclassIds.includes(e.id))
    )
      error("PRIMARY_KEY", `${e.name} needs a primary key.`, e.id);
  }
  for (const r of g.relationships) {
    unique(r.id);
    name(r.name, r.id);
    attrs(r.attributes, r.id);
    if (
      r.endpoints.length < 2 ||
      (r.type !== "n-ary" && r.endpoints.length !== 2)
    )
      error("ARITY", "Relationship arity is invalid.", r.id);
    for (const p of r.endpoints) {
      if (!g.entities.some((e) => e.id === p.entityId))
        error("DANGLING", "Relationship endpoint is missing.", r.id);
      if (
        ![0, 1].includes(p.participation.min) ||
        ![1, "*"].includes(p.participation.max)
      )
        error("BOUNDS", "Invalid participation bounds.", r.id);
    }
    if (r.type === "isa")
      error("ISA_LINK", "Use a specialization to define ISA mapping.", r.id);
    if (r.endpoints.length === 2) {
      const many = r.endpoints.filter(
        (p) => p.participation.max === "*",
      ).length;
      const expected = many === 2 ? "M:N" : many === 1 ? "1:N" : "1:1";
      if (r.cardinality !== expected)
        error(
          "CARDINALITY",
          "Cardinality does not match endpoint bounds.",
          r.id,
        );
      if (
        r.type === "identifying" &&
        (!r.ownerEntityId ||
          !r.endpoints.some(
            (p) => p.entityId === r.ownerEntityId && p.participation.max === 1,
          ) ||
          !r.endpoints.some(
            (p) =>
              g.entities.find((e) => e.id === p.entityId)?.type === "weak" &&
              p.entityId !== r.ownerEntityId,
          ))
      )
        error(
          "IDENTIFYING",
          "Identifying links need a one-side owner and a weak dependent.",
          r.id,
        );
    }
  }
  const children = new Set<string>();
  for (const s of g.specializations) {
    unique(s.id);
    if (
      !g.entities.some((e) => e.id === s.superclassId) ||
      !s.subclassIds.length
    )
      error(
        "ISA",
        "Specialization requires existing parent and children.",
        s.id,
      );
    for (const id of s.subclassIds) {
      if (
        id === s.superclassId ||
        children.has(id) ||
        !g.entities.some((e) => e.id === id)
      )
        error("ISA_CHILD", "Subclass must exist and have one parent.", s.id);
      children.add(id);
    }
    if (
      s.strategy === "table-per-hierarchy" &&
      s.disjointness === "overlapping"
    )
      error(
        "ISA_MAPPING",
        "Overlapping specializations require table-per-type.",
        s.id,
      );
    if (
      g.specializations.some(
        (t) => t !== s && t.superclassId === s.superclassId,
      )
    )
      error("ISA_GROUP", "Use one specialization group per superclass.", s.id);
  }
  return issues;
}
