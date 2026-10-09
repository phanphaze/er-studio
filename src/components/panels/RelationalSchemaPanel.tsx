"use client";
import { useMemo, useState } from "react";
import { useERStore } from "@/store/useERStore";
import {
  buildRelationalReport,
  relationalReportHtml,
  tableReportHtml,
} from "@/lib/compiler/relationalReport";
import { downloadText } from "./SqlPreviewPanel";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
export function RelationalSchemaPanel() {
  const graph = useERStore((s) => s.graph);
  const report = useMemo(() => buildRelationalReport(graph), [graph]);
  const [expanded, setExpanded] = useState(false);
  const [step, setStep] = useState(5);
  const active = report.steps.find((s) => s.number === step);
  const content = (
    <>
      <p className="muted">
        Five cumulative translation steps, with primary and foreign keys marked.
      </p>
      <label className="field-label">
        Translation step
        <select value={step} onChange={(e) => setStep(Number(e.target.value))}>
          {report.steps.map((s) => (
            <option key={s.number} value={s.number}>
              {s.number}. {s.title}
            </option>
          ))}
        </select>
      </label>
      {active && (
        <>
          <p>{active.explanation}</p>
          {step < 5 && (
            <p>
              <b>Added or changed:</b> {active.changed.join(", ") || "None"}
            </p>
          )}
          <p>
            PK = primary key · FK = foreign key. Multiple PK fields form one
            composite key.
          </p>
          {active.tables.map((t) => (
            <div
              key={t.name}
              dangerouslySetInnerHTML={{ __html: tableReportHtml(t) }}
            />
          ))}
        </>
      )}
      {report.issues.map((i, n) => (
        <p key={n} role={i.severity === "error" ? "alert" : undefined}>
          {i.message}
        </p>
      ))}
    </>
  );
  return (
    <div className="relational-report">
      <h3>Relational schema</h3>
      <div className="sql-actions">
        <Button
          size="sm"
          disabled={!report.steps.length}
          onClick={() =>
            downloadText(
              relationalReportHtml(graph.name, report),
              `${graph.name.replace(/[^a-zA-Z0-9_-]/g, "_") || "schema"}-relational-schema.html`,
              "text/html;charset=utf-8",
            )
          }
        >
          Download all steps
        </Button>
        <Button size="sm" variant="outline" onClick={() => setExpanded(true)}>
          Expand
        </Button>
      </div>
      <p className="muted">
        Download opens as formatted tables in your browser. Use Print → Save as
        PDF for submission.
      </p>
      {content}
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="schema-report-dialog">
          <DialogTitle>Relational schema — {graph.name}</DialogTitle>
          <DialogDescription>
            Inspect the tables at each translation step.
          </DialogDescription>
          <div className="relational-report">{content}</div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
