"use client";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { loader } from "@monaco-editor/react";
loader.config({ paths: { vs: "/monaco/vs" } });
import { Copy, Download, Check, Code2 } from "lucide-react";
import { useERStore } from "@/store/useERStore";
import { compileGraph } from "@/lib/compiler/sqlGenerator";
import { Button } from "@/components/ui/button";
const Editor = dynamic(() => import("@monaco-editor/react"), { ssr: false });
export function downloadText(text: string, name: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function SqlPreviewPanel() {
  const graph = useERStore((s) => s.graph);
  const result = useMemo(() => compileGraph(graph), [graph]);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <div className="sql-panel">
      <div className="panel-heading">
        <Code2 size={17} />
        <strong>PostgreSQL DDL</strong>
        <span className="badge">LIVE</span>
      </div>
      <p className="muted">
        {result.schema.tables.length} tables · compiled from your model
      </p>
      <div className="sql-actions">
        <Button
          variant="outline"
          size="sm"
          disabled={!result.sql}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(result.sql);
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            } catch {
              setMessage("Clipboard unavailable. Use Download SQL.");
            }
          }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}{" "}
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!result.sql}
          onClick={() => downloadText(result.sql, "schema.sql")}
        >
          <Download size={14} /> Download
        </Button>
      </div>
      {message && <p role="status">{message}</p>}
      {!result.sql ? (
        <div className="empty-panel">
          Resolve validation errors to generate SQL.
        </div>
      ) : (
        <Editor
          height="100%"
          language="sql"
          theme="vs-dark"
          value={result.sql}
          loading={<pre className="sql-fallback">{result.sql}</pre>}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            wordWrap: "on",
            padding: { top: 16 },
            automaticLayout: true,
          }}
        />
      )}
    </div>
  );
}
