"use client";
import {
  useMemo,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from "react";
import { CanvasMenu } from "./CanvasMenu";
import { EntitySetNode } from "./nodes/EntitySetNode";
import { expandItems } from "@/lib/ast/entitySets";
import type { Point } from "@/lib/ast/types";
import { projectGraph } from "@/lib/layout/projection";
import { organize, aligned } from "@/lib/layout/organize";
import { useSettingsStore } from "@/store/useSettingsStore";
import { exportDiagramPdf } from "@/lib/export/diagramPdf";
import {
  ReactFlow,
  useReactFlow,
  getNodesBounds,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  ReactFlowProvider,
  type Node,
  type Edge,
} from "@xyflow/react";
import { useERStore } from "@/store/useERStore";
import { AttributeNode } from "./nodes/AttributeNode";
import { EntityNode } from "./nodes/EntityNode";
import { RelationshipNode } from "./nodes/RelationshipNode";
import { ISANode } from "./nodes/ISANode";
import { CrowsFootEdge, type ERLinkData } from "./edges/CrowsFootEdge";
import { ChenEdge } from "./edges/ChenEdge";
const nodeTypes = {
  entitySet: EntitySetNode,
  attribute: AttributeNode,
  entity: EntityNode,
  relationship: RelationshipNode,
  isa: ISANode,
};
const edgeTypes = { crow: CrowsFootEdge, chen: ChenEdge };
export interface CanvasActions {
  exportPdf: () => Promise<void>;
  organize: () => Promise<void>;
  align: (mode: string) => void;
}
function Canvas({ actionsRef }: { actionsRef: Ref<CanvasActions> }) {
  const flow = useReactFlow();
  const multi = useERStore((s) => s.selectedIds);
  const setMulti = (ids: string[]) => useERStore.setState({ selectedIds: ids });
  const mode = useSettingsStore((s) => s.mode);
  const savePositions = (
    positions: Record<string, { x: number; y: number }>,
    notation = useERStore.getState().notation,
  ) =>
    useERStore.getState().commit((g) => {
      g.layouts ??= {};
      g.layouts[notation] = { ...g.layouts[notation], ...positions };
    });
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const insertionPosition = () => {
      const rect = root.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      const center = flow.screenToFlowPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
      const chen = useERStore.getState().notation === "chen";
      return {
        x: center.x - (chen ? 110 : 200),
        y: center.y - (chen ? 32 : 84),
      };
    };
    useERStore.setState({ insertionPosition });
    return () => useERStore.setState({ insertionPosition: undefined });
  }, [flow]);
  const dragging = useRef<{
    origin: Point;
    positions: Record<string, Point>;
    driver: string;
  } | null>(null);
  const startDrag = (n: Node, selected: Node[] = []) => {
    const s = useERStore.getState();
    const ids = expandItems(s.graph, [
      ...new Set([
        n.id,
        ...selected.map((n) => n.id),
        ...(s.selectedIds.includes(n.id) ? s.selectedIds : []),
      ]),
    ]);
    const positions = Object.fromEntries(
      flow
        .getNodes()
        .filter((n) => ids.includes(n.id) && n.type !== "entitySet")
        .map((n) => [n.id, { ...n.position }]),
    );
    dragging.current = { origin: { ...n.position }, positions, driver: n.id };
    s.beginTransaction();
  };
  const moveDrag = (n: Node) => {
    const base = dragging.current;
    if (!base) return;
    let dx = n.position.x - base.origin.x,
      dy = n.position.y - base.origin.y;
    // Snap the group to nearby centers/edges, preserving all relative offsets.
    const driver = flow.getNode(base.driver);
    if (driver?.type === "entity") {
      const others = flow
        .getNodes()
        .filter((o) => o.type === "entity" && !base.positions[o.id]);
      const w = driver.width ?? 400,
        h = driver.height ?? 168;
      let bestX = 8,
        bestY = 8,
        adjustX = 0,
        adjustY = 0;
      for (const o of others)
        for (const f of [0, 0.5, 1]) {
          const x =
            o.position.x + (o.width ?? 400) * f - (base.origin.x + dx + w * f);
          const y =
            o.position.y + (o.height ?? 168) * f - (base.origin.y + dy + h * f);
          if (Math.abs(x) < bestX) {
            bestX = Math.abs(x);
            adjustX = x;
          }
          if (Math.abs(y) < bestY) {
            bestY = Math.abs(y);
            adjustY = y;
          }
        }
      dx += adjustX;
      dy += adjustY;
    }
    savePositions(
      Object.fromEntries(
        Object.entries(base.positions).map(([id, p]) => [
          id,
          { x: p.x + dx, y: p.y + dy },
        ]),
      ),
    );
  };
  const endDrag = (n: Node) => {
    moveDrag(n);
    dragging.current = null;
    useERStore.getState().endTransaction();
  };

  useImperativeHandle(actionsRef, () => ({
    organize: async () => {
      const before = useERStore.getState().graph;
      const notation = useERStore.getState().notation;
      const { nodes, edges } = projectGraph(before, notation, null);
      const positions = await organize(nodes, edges);
      if (useERStore.getState().graph !== before)
        throw Error("The model changed while organizing. Please try again.");
      savePositions(positions, notation);
      setTimeout(() => flow.fitView({ padding: 0.16, duration: 350 }), 100);
    },
    align: (mode) => {
      const nodes = flow
        .getNodes()
        .filter(
          (n) =>
            n.type === "entity" && (multi.length < 2 || multi.includes(n.id)),
        );
      savePositions(aligned(nodes, mode));
    },
    exportPdf: async () => {
      const nodes = flow.getNodes().map((node) => {
        const measured = flow.getInternalNode(node.id)?.measured;
        return {
          ...node,
          width: measured?.width ?? node.measured?.width ?? 290,
          height: measured?.height ?? node.measured?.height ?? 120,
        };
      });
      if (!nodes.length) throw Error("Add an entity before exporting a PDF.");
      const viewport = root.current?.querySelector<HTMLElement>(
        ".react-flow__viewport",
      );
      if (!viewport) throw Error("Canvas is not ready. Please retry.");
      await exportDiagramPdf(
        viewport,
        getNodesBounds(nodes),
        useERStore.getState().graph.name,
      );
    },
  }));
  const graph = useERStore((s) => s.graph);
  const notation = useERStore((s) => s.notation);
  const selection = useERStore((s) => s.selection);
  const projection = useMemo(
    () => projectGraph(graph, notation, null),
    [graph, notation],
  );
  const nodes = useMemo(
    () =>
      projection.nodes.map((n) => ({
        ...n,
        selected: n.id === selection?.id || multi.includes(n.id),
      })),
    [projection, selection, multi],
  );
  const edges = useMemo(
    () =>
      projection.edges.map((e) => ({
        ...e,
        selected: Boolean(
          (selection &&
            (e.data?.relationshipId === selection.id ||
              e.data?.specializationId === selection.id)) ||
          multi.includes(
            String(e.data?.relationshipId ?? e.data?.specializationId),
          ),
        ),
      })),
    [projection, selection, multi],
  );
  return (
    <CanvasMenu toPoint={(p) => flow.screenToFlowPosition(p)}>
      <div ref={root} className="flow-root">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          colorMode={mode}
          fitView
          fitViewOptions={{ padding: 0.18, maxZoom: 0.9 }}
          minZoom={0.2}
          maxZoom={1.8}
          connectionRadius={36}
          snapToGrid
          snapGrid={[20, 20]}
          deleteKeyCode={null}
          selectionKeyCode="Shift"
          multiSelectionKeyCode="Shift"
          onNodesChange={(changes) => {
            const selections = changes.filter((c) => c.type === "select");
            if (selections.length) {
              const ids = new Set(useERStore.getState().selectedIds);
              selections.forEach((c) => {
                if (c.type === "select") {
                  if (c.selected) ids.add(c.id);
                  else ids.delete(c.id);
                }
              });
              useERStore.setState({ selectedIds: [...ids], selection: null });
            }
          }}
          onEdgesChange={(changes) => {
            const ids = new Set(useERStore.getState().selectedIds);
            let changed = false;
            for (const c of changes)
              if (c.type === "select") {
                const edge = projection.edges.find((e) => e.id === c.id);
                const id =
                  edge?.data?.relationshipId ?? edge?.data?.specializationId;
                if (id) {
                  changed = true;
                  if (c.selected) ids.add(id);
                  else ids.delete(id);
                }
              }
            if (changed) useERStore.setState({ selectedIds: [...ids] });
          }}
          onSelectionDragStart={(_, ns) => {
            if (ns[0]) startDrag(ns[0], ns);
          }}
          onSelectionDrag={(_, ns) => {
            if (ns[0]) moveDrag(ns[0]);
          }}
          onSelectionDragStop={(_, ns) => {
            if (ns[0]) endDrag(ns[0]);
          }}
          onNodeClick={(event, n) => {
            if (n.type === "attribute") return;
            if (event.shiftKey) return;
            if (n.type === "entitySet") {
              setMulti([n.id]);
              useERStore.setState({ selection: null });
              return;
            }
            if (multi.length > 1 && multi.includes(n.id)) return;
            useERStore
              .getState()
              .setSelection({
                kind:
                  n.type === "entity"
                    ? "entity"
                    : n.type === "isa"
                      ? "specialization"
                      : "relationship",
                id: n.id,
              });
          }}
          onEdgeClick={(_, e) => {
            const d = e.data as ERLinkData;
            if (d?.relationshipId)
              useERStore
                .getState()
                .setSelection({ kind: "relationship", id: d.relationshipId });
            else if (d?.specializationId)
              useERStore
                .getState()
                .setSelection({
                  kind: "specialization",
                  id: d.specializationId,
                });
          }}
          onPaneClick={() => {
            setMulti([]);
            useERStore.getState().setSelection(null);
          }}
          onNodeDragStart={(_, n, ns) => startDrag(n, ns)}
          onNodeDrag={(_, n) => moveDrag(n)}
          onNodeDragStop={(_, n) => endDrag(n)}
          onConnect={(c) => {
            if (
              c.source &&
              c.target &&
              graph.entities.some((e) => e.id === c.source) &&
              graph.entities.some((e) => e.id === c.target)
            )
              useERStore.getState().addRelationship({
                name: "relates_" + (graph.relationships.length + 1),
                type: c.source === c.target ? "recursive" : "non-identifying",
                cardinality: "1:N",
                endpoints: [
                  {
                    entityId: c.source,
                    role: "source",
                    participation: { min: 1, max: 1 },
                    attributeId: c.sourceHandle?.startsWith("attr-out-")
                      ? c.sourceHandle.slice(9)
                      : undefined,
                  },
                  {
                    entityId: c.target,
                    role: "target",
                    participation: { min: 0, max: "*" },
                    attributeId: c.targetHandle?.startsWith("attr-in-")
                      ? c.targetHandle.slice(8)
                      : undefined,
                  },
                ],
                attributes: [],
                onDelete: "RESTRICT",
                onUpdate: "CASCADE",
              });
          }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1}
            color={mode === "light" ? "#bac4d3" : "#303543"}
          />
          <Controls showInteractive={false} />
          <MiniMap
            nodeColor={(n) =>
              (n.data.entity as { color: string } | undefined)?.color ??
              "#a78bfa"
            }
            maskColor={
              mode === "light" ? "rgba(225,232,240,.6)" : "rgba(10,12,17,.6)"
            }
            pannable
            zoomable
          />
          {multi.length > 1 && (
            <div className="selection-actions nodrag nopan">
              <span>{multi.length} selected</span>
              <button onClick={() => useERStore.getState().deleteSelected()}>
                Delete selection
              </button>
              <button onClick={() => setMulti([])}>Clear</button>
            </div>
          )}
          <div className="canvas-caption">
            <span className="canvas-chip">PUBLIC SCHEMA</span>
            <span>Drag between handles to connect</span>
          </div>
        </ReactFlow>
      </div>
    </CanvasMenu>
  );
}
export function ERCanvas({ actionsRef }: { actionsRef: Ref<CanvasActions> }) {
  return (
    <ReactFlowProvider>
      <Canvas actionsRef={actionsRef} />
    </ReactFlowProvider>
  );
}
