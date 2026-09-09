"use client";
import { useMemo, useImperativeHandle, useRef, type Ref } from "react";
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
import { compileGraph } from "@/lib/compiler/sqlGenerator";
import { AttributeNode } from "./nodes/AttributeNode";
import type { Attribute } from "@/lib/ast/types";
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
}
function Canvas({ actionsRef }: { actionsRef: Ref<CanvasActions> }) {
  const flow = useReactFlow();
  const root = useRef<HTMLDivElement>(null);
  useImperativeHandle(actionsRef, () => ({
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
  const { nodes, edges } = useMemo(() => {
    const compiled = compileGraph(graph);
    const nodes: Node[] = graph.entities.map((e) => ({
      id: e.id,
      type: "entity",
      position: e.position,
      data: {
        entity: e,
        foreignColumns: compiled.schema.tables
          .find((t) => t.name === e.name)
          ?.columns.filter((c) => !c.sourceAttributeId),
      },
      selected: selection?.id === e.id,
      dragHandle: ".entity-drag",
    }));
    const edges: Edge<ERLinkData>[] = [];
    if (notation === "chen") {
      for (const e of graph.entities) {
        const addAttrs = (
          attrs: Attribute[],
          parentId: string,
          x: number,
          y: number,
        ) =>
          attrs.forEach((a, i) => {
            nodes.push({
              id: a.id,
              type: "attribute",
              position: { x: x + i * 160, y },
              data: { attribute: a, ownerId: e.id },
              draggable: false,
              selectable: false,
            });
            edges.push({
              id: "attribute-" + a.id,
              source: parentId,
              target: a.id,
              sourceHandle: parentId === e.id ? "out" : "out",
              targetHandle: "in",
              type: "default",
              style: { stroke: "#586375" },
            });
            if (a.compositeChildren?.length)
              addAttrs(a.compositeChildren, a.id, x + i * 160, y - 100);
          });
        addAttrs(e.attributes, e.id, e.position.x - 100, e.position.y - 150);
      }
    }
    for (const r of graph.relationships) {
      const a = r.endpoints[0],
        b = r.endpoints[1];
      if (!a || !b) continue;
      const data: ERLinkData = {
        label: r.name,
        start: a.participation,
        end: b.participation,
        identifying: r.type === "identifying",
        uml: notation === "uml",
        relationshipId: r.id,
      };
      if (notation === "chen" || r.type === "n-ary") {
        const ea = graph.entities.find((e) => e.id === a.entityId),
          eb = graph.entities.find((e) => e.id === b.entityId);
        nodes.push({
          id: r.id,
          type: "relationship",
          position: r.position ?? {
            x: ((ea?.position.x ?? 0) + (eb?.position.x ?? 500)) / 2 + 100,
            y: ((ea?.position.y ?? 0) + (eb?.position.y ?? 0)) / 2 - 60,
          },
          data: { relationship: r },
          selected: selection?.id === r.id,
        });
        r.endpoints.forEach((p, i) =>
          edges.push({
            id: r.id + "-" + i,
            source: p.entityId,
            target: r.id,
            sourceHandle: "out",
            targetHandle: "in",
            type: "chen",
            data: { ...data, end: p.participation },
            selected: selection?.id === r.id,
          }),
        );
      } else
        edges.push({
          id: r.id,
          source: a.entityId,
          target: b.entityId,
          sourceHandle: a.attributeId ? `attr-out-${a.attributeId}` : "out",
          targetHandle: b.attributeId ? `attr-in-${b.attributeId}` : "in",
          type: "crow",
          data,
          selected: selection?.id === r.id,
        });
    }
    for (const s of graph.specializations) {
      nodes.push({
        id: s.id,
        type: "isa",
        position: s.position,
        data: { specialization: s },
        selected: selection?.id === s.id,
      });
      edges.push({
        id: s.id + "-parent",
        source: s.superclassId,
        target: s.id,
        sourceHandle: "out",
        targetHandle: "in",
      });
      for (const id of s.subclassIds)
        edges.push({
          id: s.id + "-" + id,
          source: s.id,
          target: id,
          sourceHandle: "out",
          targetHandle: "in",
        });
    }
    return { nodes, edges };
  }, [graph, notation, selection]);
  return (
    <div ref={root} className="flow-root">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        colorMode="dark"
        fitView
        fitViewOptions={{ padding: 0.18, maxZoom: 0.9 }}
        minZoom={0.2}
        maxZoom={1.8}
        connectionRadius={36}
        snapToGrid
        snapGrid={[20, 20]}
        deleteKeyCode={null}
        onNodeClick={(_, n) => {
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
        onEdgeClick={(_, e) =>
          useERStore.getState().setSelection({
            kind: "relationship",
            id: (e.data as ERLinkData)?.relationshipId ?? e.id,
          })
        }
        onPaneClick={() => useERStore.getState().setSelection(null)}
        onNodeDragStart={() => useERStore.getState().beginTransaction()}
        onNodeDrag={(_, n) =>
          useERStore
            .getState()
            .moveEntities([{ id: n.id, position: n.position }])
        }
        onNodeDragStop={(_, n) => {
          useERStore
            .getState()
            .moveEntities([{ id: n.id, position: n.position }]);
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
          color="#303543"
        />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(n) =>
            (n.data.entity as { color: string } | undefined)?.color ?? "#a78bfa"
          }
          maskColor="rgba(10,12,17,.6)"
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
