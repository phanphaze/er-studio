import type { ERGraph, RelationalTable, ValidationIssue } from "../ast/types";
import { validateGraph } from "../ast/schemaValidator";
import { erToRelational } from "./erToRelational";
export interface TranslationStep {
  number: number;
  title: string;
  explanation: string;
  tables: RelationalTable[];
  changed: string[];
}
const RULES = [
  [
    "Strong entities + unnest composite attributes",
    "Create one table per strong entity. Replace composite attributes with their atomic components. Mark the entity key as the primary key; defer multivalued attributes and relationship foreign keys. Derived attributes are not stored. Selected inheritance strategies are also applied here.",
  ],
  [
    "Weak entities",
    "Add weak-entity tables. Their primary key combines the owner's full primary key with the weak entity's partial key. The inherited owner columns also form a foreign key to the owner.",
  ],
  [
    "Multivalued attributes",
    "Create a separate table for each multivalued entity attribute, including composite values. Combine the owning table's primary key with the atomic value columns to form its primary key. Add a foreign key to the owning table.",
  ],
  [
    "Relationships",
    "For 1:N, put the one-side key on the many side. For 1:1, use the selected referencing side and a UNIQUE constraint. For M:N and n-ary relationships, add a table containing participant keys and relationship attributes. Identifying-relationship attributes go on the weak table. Multivalued relationship attributes are expanded here, once their owning table exists.",
  ],
  [
    "Final relational schema — primary and foreign keys",
    "Final cumulative set of tables. PK marks every column in the table's primary key; FK marks foreign-key membership. Composite keys and composite foreign keys are listed as grouped constraints below each table. Additional enforcement requirements are listed separately.",
  ],
];
export function buildRelationalReport(graph: ERGraph) {
  const issues: ValidationIssue[] = validateGraph(graph);
  const steps: TranslationStep[] = [];
  if (issues.some((i) => i.severity === "error")) return { steps, issues };
  try {
    let previous: RelationalTable[] = [];
    const schema = erToRelational(graph, (number, tables) => {
      const changed = tables
        .filter(
          (t) =>
            JSON.stringify(t) !==
            JSON.stringify(previous.find((p) => p.name === t.name)),
        )
        .map((t) => t.name);
      steps.push({
        number,
        title: RULES[number - 1][0],
        explanation: RULES[number - 1][1],
        tables,
        changed,
      });
      previous = tables;
    });
    for (const table of schema.tables) {
      if (
        !table.primaryKey.length ||
        table.primaryKey.some(
          (key) => !table.columns.some((c) => c.name === key),
        )
      )
        throw Error(`Invalid primary key in ${table.name}`);
      for (const fk of table.foreignKeys) {
        const target = schema.tables.find((t) => t.name === fk.referencedTable);
        if (
          !target ||
          fk.columns.length !== fk.referencedColumns.length ||
          fk.columns.some(
            (c) => !table.columns.some((col) => col.name === c),
          ) ||
          fk.referencedColumns.some(
            (c) => !target.columns.some((col) => col.name === c),
          )
        )
          throw Error(`Invalid foreign key in ${table.name}`);
      }
    }
    issues.push(
      ...schema.warnings.map((message) => ({
        severity: "warning" as const,
        code: "ENFORCEMENT",
        message,
      })),
    );
  } catch (error) {
    steps.length = 0;
    issues.push({
      severity: "error",
      code: "TRANSLATION",
      message: error instanceof Error ? error.message : "Translation failed",
    });
  }
  return { steps, issues };
}
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function tableReportHtml(table: RelationalTable): string {
  const key = (name: string) =>
    [
      table.primaryKey.includes(name) ? "PK" : "",
      table.foreignKeys.some((f) => f.columns.includes(name)) ? "FK" : "",
    ]
      .filter(Boolean)
      .join(", ");
  return `<article><h3>${escape(table.name)}</h3><table><thead><tr><th>Attribute</th><th>Type</th><th>Key</th><th>Nullable</th></tr></thead><tbody>${table.columns.map((c) => `<tr><td>${escape(c.name)}${c.internal ? " (implementation helper)" : ""}</td><td>${escape(c.type)}</td><td><b>${key(c.name)}</b></td><td>${c.nullable ? "Yes" : "No"}</td></tr>`).join("")}</tbody></table><p><b>PK:</b> (${table.primaryKey.map(escape).join(", ")})</p>${table.foreignKeys.map((f) => `<p><b>FK:</b> (${f.columns.map(escape).join(", ")}) → ${escape(f.referencedTable)}(${f.referencedColumns.map(escape).join(", ")})</p>`).join("")}${table.uniqueConstraints.map((u) => `<p><b>UNIQUE:</b> (${u.map(escape).join(", ")})</p>`).join("")}${table.checks.map((c) => `<p><b>CHECK:</b> ${escape(c)}</p>`).join("")}</article>`;
}
export function relationalReportHtml(
  name: string,
  report: ReturnType<typeof buildRelationalReport>,
) {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(name)} — Relational schema</title><style>body{font:15px/1.5 system-ui,sans-serif;color:#172033;background:white;max-width:1100px;margin:40px auto;padding:0 24px}h1,h2,h3{line-height:1.25}section{margin:40px 0}article{margin:24px 0;break-inside:avoid}table{border-collapse:collapse;width:100%;table-layout:fixed}th,td{border:1px solid #b9c1ce;padding:8px;text-align:left;overflow-wrap:anywhere}th{background:#eef2f7}p{overflow-wrap:anywhere}thead{display:table-header-group}@media print{body{margin:0;font-size:10pt}section{break-before:page}section:first-of-type{break-before:auto}article{break-inside:auto}tr{break-inside:avoid}@page{size:A4;margin:15mm}</style><h1>${escape(name)}</h1><p>ER-to-relational translation · PK = primary key; FK = foreign key. Multiple PK-marked columns form one composite key.</p><p>Each step shows the cumulative schema at that point. Rules reflect this modeler's configured mapping and should be compared with your class conventions.</p>${report.steps.map((s) => `<section><h2>${s.number}. ${escape(s.title)}</h2><p>${escape(s.explanation)}</p>${s.number < 5 ? `<p>Added or changed: ${s.changed.length ? s.changed.map(escape).join(", ") : "None in this step"}.</p>` : ""}${s.tables.length ? s.tables.map(tableReportHtml).join("") : "<p>No tables at this step.</p>"}</section>`).join("")}${report.issues.length ? `<section><h2>Validation and enforcement notes</h2>${report.issues.map((i) => `<p>${escape(i.message)}</p>`).join("")}</section>` : ""}</html>`;
}
