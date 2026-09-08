# ER Studio

A modular Next.js 15 / React 19 / strict TypeScript ER modeler. The AST is framework-independent; React Flow is a projection, never the source of truth.

## Development

```bash
npm ci
npm run dev
npm run typecheck
npm test
npm run build
```

`npm run build` creates the Next.js static frontend in `out/` and stages a Worker-backed deployment in `dist/`. Monaco's assets are copied from the locked local dependency into `public/monaco` by prebuild/predev; no third-party editor CDN is required.

## Architecture

- `src/lib/ast/types.ts`: versioned domain model, relationship endpoint participation, specialization, relational IR and validation diagnostics.
- `src/lib/ast/schemaValidator.ts`: semantic validation before lowering.
- `src/lib/ast/serialization.ts`: bounded, runtime-validated JSON import.
- `src/lib/compiler/erToRelational.ts`: deterministic transformation into relational tables, columns, keys and constraints.
- `src/lib/compiler/sqlGenerator.ts`: quoted PostgreSQL DDL, deferred FK creation, MATCH FULL composite references, foreign-key indexes and compilation diagnostics.
- `src/store/useERStore.ts`: Zustand + Immer history and mutations. `beginTransaction` / `endTransaction` coalesce edits and drags. Selection and notation are outside document history. New edits after undo invalidate redo; history is retained for the current session without a fixed cap.
- `src/components/canvas`: independent entity, Chen attribute, relationship and ISA nodes plus notation edges.
- `src/components/panels`: model editing, validation, Monaco SQL preview and command interface.
- `src/components/ui`: composed shadcn-style Button plus Radix Dialog and Tabs primitives.

## Model and compiler semantics

Endpoint min/max describes the count of that endpoint per opposite instance. The `*` endpoint of a binary 1:N relationship holds the generated FK; a 1:1 link uses `foreignKeyEndpoint` (default endpoint 1). Endpoints' `attributeId` fields choose visual connection anchors, not pre-existing physical FK columns. Compiler-generated FK columns are displayed with FK badges and are not independently editable.

Weak entities require exactly one identifying owner and at least one partial key. Owner keys may be composite or inherited. Composite attributes flatten recursively; derived attributes are omitted; multivalued attributes produce child tables with owner keys plus value keys. M:N and n-ary relationships produce junctions with role-specific references. N-ary `max=1` endpoints generate uniqueness over the remaining roles. Referential actions are explicit and invalid SET NULL combinations block generation.

Table-per-type subclasses inherit the parent primary key (declared subclass PKs are superseded). Table-per-hierarchy uses a reserved `__type` discriminator with CHECK constraints and prefixed nullable subtype columns, guarded by subtype checks when required. A TPH group must be disjoint; nested TPH groups are rejected and should be flattened. Overlapping hierarchies use TPT.

PostgreSQL does not support cross-table CHECK constraints. Total participation and TPT total/disjoint membership require application enforcement or separately authored constraint triggers; compilation surfaces these as warnings. TPH references to a subtype target the shared table and also need membership enforcement. Generated DDL is a fresh-schema creation script, not a migration/diff engine. SQL rendering accepts trusted relational IR; untrusted input must go through `parseModel` then `compileGraph`.

## Interaction

- Create entities with the toolbar or Cmd/Ctrl+K.
- Connect entity or attribute handles to add relationships, including self-links.
- Edit names/types inline. Reorder fields with the grip or focus it and press up/down.
- Select an entity/edge to inspect properties. Selected entities and edges have floating actions.
- Switch Crow's Foot, Chen or UML without modifying the AST.
- Create specializations with ISA and configure mapping in the inspector.
- Undo/redo with Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z (or Ctrl+Y).
- Save/open versioned JSON models using header controls. Open is undoable. Export executable SQL from the header or live SQL panel.

Models are explicitly saved to the project workspace database; JSON remains available as a portable backup. There is no autosave, collaboration or separate account system. The initial commerce graph is a clearly named editable example. This implementation is a tested foundation, not a claim of full production operational readiness or exhaustive ER notation conformance. Browser interaction and accessibility audits have not been performed.

## Verification

Vitest covers document history, destructive graph edits, nested attribute duplication, deterministic compilation, weak composite keys, multivalued attributes, both ISA strategies, recursive references, invalid models and SQL identifier quoting. PGlite executes generated PostgreSQL DDL and checks CHECK/UNIQUE failures. TypeScript and Next.js production build are separate gates.

## Project workspace and exports (update)

Workspace in the breadcrumb and the sidebar project switcher open the project browser. Create a blank project, open an existing saved project, or import a JSON model as a new unsaved model. Save project writes the current AST to platform-backed D1 storage; saved projects persist across sessions. The project name above the canvas is editable. This is explicit save, not autosave. A dirty-state indicator, leave-page warning and save/discard/cancel flow protect unsaved edits. Stale writes return a revision conflict rather than overwriting another tab's changes; Save as new project preserves a separate copy.

The owner-private Site perimeter protects this workspace. Projects belong to this Site; if the Site is shared later, its saved projects are shared with that audience. There is no separate per-project ACL.

The Worker in `worker/index.ts` serves the prepared-query project API; `db/schema.ts` and checked-in Drizzle migrations own the D1 schema. The Next.js 15 frontend remains a static export. The build stages it under `dist/client`, bundles the Worker to `dist/server/index.js`, and includes logical bindings and migrations. Local `next dev` runs the editor; project API operations require the deployed Worker and DB (or a configured local Worker environment).

Both sidebar sections now collapse. Drag either vertical separator to resize a panel, drag it to the edge to collapse, double-click to reset, or use the panel buttons to reopen. Focus a separator and use left/right arrows, Home (collapse), or End (reset). Panel widths are device-local UI preferences only.

PDF exports capture the complete diagram at its current notation, independent of canvas pan/zoom, and fit it onto an A3 page with title and margins. The diagram is a bounded-resolution raster embedded in the PDF, not editable vector artwork. Very large diagrams may require zooming in the PDF. JSON backups and SQL export remain available.

Additional integration tests execute the generated SQLite migration and project API queries, including revision conflicts, malformed input, separate projects and storage failures. Browser/PDF visual QA has not been performed.
