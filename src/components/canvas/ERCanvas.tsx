"use client";
import {
  useMemo,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from "react";
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
  const [multi, setMulti] = useState<string[]>([]);
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
          selection &&
          (e.data?.relationshipId === selection.id ||
            e.data?.specializationId === selection.id),
        ),
      })),
    [projection, selection],
  );
  return (
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
        onNodeClick={(event, n) => {
          if (n.type === "entity")
            setMulti((previous) =>
              event.shiftKey
                ? previous.includes(n.id)
                  ? previous.filter((id) => id !== n.id)
                  : [...previous, n.id]
                : [n.id],
            );
          if (n.type === "attribute") return;
          useERStore.getState().setSelection({
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
              .setSelection({ kind: "specialization", id: d.specializationId });
        }}
        onPaneClick={() => {
          setMulti([]);
          useERStore.getState().setSelection(null);
        }}
        onNodeDragStart={() => useERStore.getState().beginTransaction()}
        onNodeDrag={(_, n) => savePositions({ [n.id]: n.position })}
        onNodeDragStop={(_, n) => {
          savePositions({ [n.id]: n.position });
          useERStore.getState().endTransaction();
        }}
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
            (n.data.entity as { color: string } | undefined)?.color ?? "#a78bfa"
          }
          maskColor={
            mode === "light" ? "rgba(225,232,240,.6)" : "rgba(10,12,17,.6)"
          }
          pannable
          zoomable
        />
        <div className="canvas-caption">
          <span className="canvas-chip">PUBLIC SCHEMA</span>
          <span>Drag between handles to connect</span>
        </div>
      </ReactFlow>
    </div>
  );
}
export function ERCanvas({ actionsRef }: { actionsRef: Ref<CanvasActions> }) {
  return (
    <ReactFlowProvider>
      <Canvas actionsRef={actionsRef} />
    </ReactFlowProvider>
  );
}
