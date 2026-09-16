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

## Attribute editing UX

Click a field in an entity block (including indented composite children), or a Chen attribute oval, to select its owner, reopen the inspector if collapsed, switch to Properties, and scroll/highlight its editor. These navigation requests are UI state and never enter undo history or change saved models. Right-click a field for Edit properties or Delete attribute. Deleting a composite also deletes its descendants; Undo restores them and their connection anchors. Nested attributes reorder only among siblings. Composite parents display `composite` / `composite[]` badges in Crow's Foot and UML rather than a misleading scalar type.

Payment-address membership is modeled using a standard CreditCard–Address relationship, plus the Customer ownership relationships. The existing relationship editor supplies cardinality and referential actions. Requiring that the card and address belong to the same customer is an additional cross-relationship constraint, not an attribute functional-dependency arrow; automatic enforcement of that constraint is not implemented.

## Field controls, generated keys, and connection targets

Text and varchar fields support minimum/maximum character lengths and an optional ASCII digits-only check. Equal min/max specifies an exact length. Store phone/card identifiers as text to preserve leading zeros. Limits are emitted as PostgreSQL CHECK constraints, including for nested children, and round-trip through saved projects. `time` is a PostgreSQL time-of-day type without a date or time zone; use `timestamptz` for instants.

`+ Address field` creates an address composite preset (street, optional address_line_2, city, optional state, postal_code, country); all children remain editable. Multivalued still creates a repeated-address child table. Address is a modeling preset, not a proprietary SQL scalar type.

Entity blocks size to their contents within a bounded width, and long names wrap instead of being covered by the type column. Dragging a field grip previews order as it crosses sibling rows, animates their positions, and records one undo transaction. Generated FK rows are clickable, appear in Properties, allow name overrides for relationship-generated columns, and link to the defining relationship. Their type remains derived from the referenced key; nullability and actions are edited through the relationship to keep the model consistent. Overrides are stored by generated name, so renaming an owner/relationship may require setting the override again.

Connection handles have enlarged transparent hit areas, connection snapping uses a 36-pixel radius, and edge selection uses a 30-pixel interaction stroke. Success notifications disappear after 3.5 seconds; actionable errors remain until dismissed. Automated tests cover length/digit enforcement in PostgreSQL, time, address preset undo, FK renaming and file round-trips; browser interaction and visual animation QA have not been run.

## Participation, notation layout, and appearance

Select a relationship and use each endpoint’s Participation controls. The prompt names the other entity so the direction is explicit. Presets cover optional/required one or many; Custom enables integer minimum/maximum counts and an unbounded maximum. Overall one-to-one/one-to-many/many-to-many cardinality follows the endpoint maxima. Chen uses double lines for mandatory participation. Relationship attributes appear as Chen ovals or editable rows in relationship cards in other notations.

Generated SQL enforces applicable FK nullability and uniqueness. Mandatory participation from the referenced side, junction minimum counts, and finite custom counts require cross-row, transaction-safe enforcement beyond ordinary PostgreSQL CHECK constraints; compilation warns about those limits rather than claiming to enforce them.

Chen projection reserves non-overlapping boxes for entities, relationship diamonds, and nested attribute ovals. Connections choose facing sides and use distinct ordered ports. Orthogonal routing penalizes crossings and shared segments and searches around node obstacles; it is heuristic, not a guarantee of a globally crossing-free drawing. Auto-organize uses deterministic ELK layered layout. Align/distribute affects Shift-selected entities, or all entities when fewer than two are selected. Layout changes, including individual oval moves, are undoable and saved per notation with the project. Auto-organize does not overwrite graph changes made while it is calculating.

The inspector Settings tab controls light/dark mode, accent color, and contrast. Appearance preferences are device-local; model data remains in project storage. PDF background and SQL editor follow the selected appearance. Automated geometry, routing, layout determinism, participation validation, serialization and undo tests cover these additions; browser visual QA has not been performed.

## Cardinality and Chen corrections

Global Settings now opens from the header gear. It controls appearance and cardinality display: words, min/max tuples, numeric dot ranges, arrowheads, or crow’s feet. Arrows are an explicitly documented display convention (one head for at most one, two for many), with numeric limits retained. Accent tokens apply to navigation, tabs, focus, selection and controls. Decorative routed ports stay invisible; Chen’s interactive new-link handles appear outside entity text on hover/selection.

Each endpoint specifies the number of that entity for a fixed combination of all other roles. This applies equally to binary and ternary relationships. Total/partial entity participation is distinct for n-ary relationships and renders double/single Chen lines; binary controls synchronize total participation with the opposite endpoint’s minimum. Inversion swaps binary endpoint constraints, and the directional summary now changes accordingly; n-ary relationships expose individual controls instead of an ambiguous invert operation.

Finite upper bounds now compile to internal occupancy-slot columns, CHECK/UNIQUE constraints, and allocation triggers. Each slot group uses the other endpoint keys (all other roles for n-ary relationships). UNIQUE enforces capacity even under concurrent writes; conflicting concurrent slot allocations may reject a write that must be retried. Inserts omit internal slot columns. Deletes free slots; updates that change participant keys reallocate them. Max-one ternary limits use UNIQUE on the remaining roles. Universal minimum and total-participation requirements that depend on missing rows still produce enforcement warnings; they are not implemented as global assertions.

Chen Auto-organize excludes attribute leaves from the main topology layout, orients relationship hubs between participants, and reserves a radial attribute cluster around each owner. Per-notation positions remain saved and undoable. Tests execute bounded binary, one-to-many and ternary DDL against PostgreSQL, including rejection, deletion capacity reuse, update reassignment, hostile identifiers, inversion and layout regression.
