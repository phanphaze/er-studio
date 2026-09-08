import type {
  Attribute,
  ERGraph,
  RelationalSchema,
  RelationalTable,
  Relationship,
  ReferentialAction,
} from "../ast/types";
export const quote = (s: string) => '"' + s.replaceAll('"', '""') + '"';
const literal = (s: string) => "'" + s.replaceAll("'", "''") + "'";
/** Deterministic graph lowering. No rendering or framework dependencies. */
export function erToRelational(g: ERGraph): RelationalSchema {
  const tables = new Map<string, RelationalTable>();
  const byEntity = new Map<string, RelationalTable>();
  const pending: { table: RelationalTable; attr: Attribute; prefix: string }[] =
    [];
  const warnings: string[] = [];
  const create = (name: string): RelationalTable => {
    if (tables.has(name)) throw Error(`Table name collision: ${name}`);
    const t: RelationalTable = {
      name,
      columns: [],
      primaryKey: [],
      uniqueConstraints: [],
      foreignKeys: [],
      checks: [],
    };
    tables.set(name, t);
    return t;
  };
  const add = (
    t: RelationalTable,
    a: Attribute,
    prefix = "",
    forceNullable = false,
  ) => {
    const n = prefix + a.name;
    if (a.isDerived) return;
    if (a.isMultivalued) {
      pending.push({ table: t, attr: a, prefix });
      return;
    }
    if (a.compositeChildren?.length) {
      for (const c of a.compositeChildren)
        add(
          t,
          {
            ...c,
            isPrimaryKey: a.isPrimaryKey || c.isPrimaryKey,
            isPartialKey: a.isPartialKey || c.isPartialKey,
          },
          n + "_",
          forceNullable,
        );
      return;
    }
    if (t.columns.some((c) => c.name === n))
      throw Error(`Column name collision: ${t.name}.${n}`);
    t.columns.push({
      name: n,
      type: a.type,
      nullable:
        forceNullable || (!(a.isPrimaryKey || a.isPartialKey) && a.isNullable),
      sourceAttributeId: a.id,
    });
    if ((a.isPrimaryKey || a.isPartialKey) && !forceNullable)
      t.primaryKey.push(n);
    if (a.isUnique) t.uniqueConstraints.push([n]);
    if (a.check) {
      if (
        ![">", ">=", "<", "<=", "=", "<>"].includes(a.check.operator) ||
        !Number.isFinite(a.check.value)
      )
        throw Error("Invalid CHECK");
      t.checks.push(`${quote(n)} ${a.check.operator} ${a.check.value}`);
    }
  };
  const fk = (
    target: RelationalTable,
    source: RelationalTable,
    prefix: string,
    nullable: boolean,
    key: boolean,
    onDelete: ReferentialAction = "CASCADE",
    onUpdate: ReferentialAction = "CASCADE",
  ) => {
    if (!source.primaryKey.length)
      throw Error(`${source.name} has no primary key`);
    if (
      (onDelete === "SET NULL" && !nullable) ||
      (onUpdate === "SET NULL" && !nullable)
    )
      throw Error(`SET NULL requires nullable foreign keys on ${target.name}`);
    const cols = source.primaryKey.map((n) => {
      const col = source.columns.find((c) => c.name === n)!;
      const name = prefix + "_" + n;
      if (target.columns.some((c) => c.name === name))
        throw Error(`Column name collision: ${target.name}.${name}`);
      target.columns.push({ name, type: col.type, nullable });
      if (key) target.primaryKey.push(name);
      return name;
    });
    target.foreignKeys.push({
      name: `fk_${target.foreignKeys.length + 1}`,
      columns: cols,
      referencedTable: source.name,
      referencedColumns: [...source.primaryKey],
      onDelete,
      onUpdate,
    });
    return cols;
  };
  const building = new Set<string>();
  const built = new Set<string>();
  const build = (id: string): RelationalTable => {
    if (building.has(id)) throw Error("Cyclic ownership or inheritance");
    if (built.has(id)) return byEntity.get(id)!;
    building.add(id);
    const e = g.entities.find((e) => e.id === id);
    if (!e) throw Error("Missing entity");
    const spec = g.specializations.find((s) => s.subclassIds.includes(id));
    let t: RelationalTable;
    if (spec?.strategy === "table-per-hierarchy") {
      t = build(spec.superclassId);
      for (const a of e.attributes.filter((a) => !a.isPrimaryKey)) {
        add(t, a, e.name + "_", true);
        if (
          !a.isNullable &&
          !a.isDerived &&
          !a.isMultivalued &&
          !a.compositeChildren?.length
        )
          t.checks.push(
            `${quote("__type")} <> ${literal(e.name)} OR ${quote(e.name + "_" + a.name)} IS NOT NULL`,
          );
      }
    } else {
      t = create(e.name);
      if (spec) {
        const parent = build(spec.superclassId);
        fk(t, parent, parent.name, false, true);
        for (const a of e.attributes.filter((a) => !a.isPrimaryKey)) add(t, a);
      } else for (const a of e.attributes) add(t, a);
      if (e.type === "weak") {
        const r = g.relationships.find(
          (r) =>
            r.type === "identifying" &&
            r.ownerEntityId !== id &&
            r.endpoints.some((p) => p.entityId === id),
        );
        if (!r?.ownerEntityId) throw Error("Missing weak owner");
        const parent = build(r.ownerEntityId);
        fk(t, parent, parent.name, false, true, r.onDelete, r.onUpdate);
      }
    }
    byEntity.set(id, t);
    building.delete(id);
    built.add(id);
    return t;
  };
  for (const e of [...g.entities].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  ))
    build(e.id);
  for (const s of g.specializations) {
    if (
      s.strategy === "table-per-hierarchy" &&
      g.specializations.some((t) => s.subclassIds.includes(t.superclassId))
    )
      throw Error(
        "Nested table-per-hierarchy groups require a single flattened specialization group.",
      );
    if (
      s.strategy === "table-per-hierarchy" &&
      g.relationships.some((r) =>
        r.endpoints.some((p) => s.subclassIds.includes(p.entityId)),
      )
    )
      warnings.push(
        `${s.name}: foreign keys to subclasses reference the shared table; subclass membership needs application enforcement.`,
      );
    const t = byEntity.get(s.superclassId)!;
    if (s.strategy === "table-per-hierarchy") {
      if (t.columns.some((c) => c.name === "__type"))
        throw Error("Reserved discriminator __type");
      t.columns.push({ name: "__type", type: "text", nullable: false });
      const values = s.subclassIds.map(
        (id) => g.entities.find((e) => e.id === id)!.name,
      );
      if (s.completeness === "partial")
        values.push(g.entities.find((e) => e.id === s.superclassId)!.name);
      t.checks.push(
        `${quote("__type")} IN (${values.map(literal).join(", ")})`,
      );
    } else if (s.disjointness === "disjoint" || s.completeness === "total")
      warnings.push(
        `${s.name}: table-per-type ${s.disjointness}/${s.completeness} membership requires cross-table enforcement in application logic or constraint triggers.`,
      );
  }
  for (const r of [...g.relationships].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  )) {
    if (r.type === "identifying") {
      const t = byEntity.get(
        r.endpoints.find((p) => p.entityId !== r.ownerEntityId)!.entityId,
      )!;
      r.attributes.forEach((a) => add(t, a, r.name + "_"));
      continue;
    }
    if (r.cardinality === "M:N" || r.type === "n-ary") {
      const t = create(r.name);
      const roleColumns: string[][] = [];
      for (const [i, p] of r.endpoints.entries()) {
        const source = byEntity.get(p.entityId)!;
        roleColumns.push(
          fk(
            t,
            source,
            p.role || `${source.name}_${i + 1}`,
            false,
            true,
            r.onDelete,
            r.onUpdate,
          ),
        );
      }
      if (r.type === "n-ary")
        r.endpoints.forEach((p, i) => {
          if (p.participation.max === 1)
            t.uniqueConstraints.push(
              roleColumns.filter((_, j) => j !== i).flat(),
            );
        });
      r.attributes.forEach((a) => add(t, a));
    } else {
      const ti =
        r.cardinality === "1:N"
          ? r.endpoints.findIndex((p) => p.participation.max === "*")
          : (r.foreignKeyEndpoint ?? 1);
      if (ti < 0 || ti > 1) throw Error("Invalid foreign key endpoint");
      const target = r.endpoints[ti],
        source = r.endpoints[1 - ti];
      const tt = byEntity.get(target.entityId)!,
        st = byEntity.get(source.entityId)!;
      const cols = fk(
        tt,
        st,
        r.name + "_" + (source.role || st.name),
        source.participation.min === 0,
        false,
        r.onDelete,
        r.onUpdate,
      );
      if (r.cardinality === "1:1") tt.uniqueConstraints.push(cols);
      r.attributes.forEach((a) => add(tt, a, r.name + "_"));
    }
    if (r.endpoints.some((p) => p.participation.min === 1))
      warnings.push(
        `${r.name}: minimum participation on the referenced side needs cross-row enforcement; foreign keys enforce referencing-side participation only.`,
      );
  }
  for (let i = 0; i < pending.length; i++) {
    const { table, attr, prefix } = pending[i];
    const t = create(table.name + "_" + prefix + attr.name);
    fk(t, table, table.name, false, true);
    add(
      t,
      { ...attr, isMultivalued: false, isPrimaryKey: true, isNullable: false },
      "",
    );
  }
  for (const t of tables.values()) {
    if (!t.primaryKey.length) throw Error(`${t.name} has no primary key`);
    for (const c of t.columns) {
      if (new TextEncoder().encode(c.name).length > 63)
        throw Error(
          `Generated column name exceeds PostgreSQL limit: ${c.name}`,
        );
    }
    if (new TextEncoder().encode(t.name).length > 63)
      throw Error(`Generated table name exceeds PostgreSQL limit: ${t.name}`);
  }
  return {
    tables: [...tables.values()].sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
    ),
    warnings,
  };
}
