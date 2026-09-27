import { placeLabel } from "./labels";
import type { Node, Edge } from "@xyflow/react";
import type { Attribute, ERGraph, Notation, Selection } from "../ast/types";
import { attributeRows } from "../ast/attributes";
import { compileGraph } from "../compiler/sqlGenerator";
import {
  relationshipCardinality,
  totalParticipation,
  participationLabel,
} from "../ast/participation";
import {
  freePosition,
  labelPoint,
  facing,
  portPoint,
  route,
  type Box,
  type Port,
} from "./geometry";
import type { ERLinkData } from "@/components/canvas/edges/CrowsFootEdge";
export function projectGraph(
  graph: ERGraph,
  notation: Notation,
  selection: Selection,
  multi: string[] = [],
) {
  const compiled = compileGraph(graph);
  const nodes: Node[] = [],
    edges: Edge<ERLinkData>[] = [],
    boxes: Box[] = [];
  const layouts = graph.layouts?.[notation] ?? {};
  const add = (n: Node, width: number, height: number, avoid = false) => {
    let pos = layouts[n.id] ?? n.position;
    if (avoid && !layouts[n.id])
      pos = freePosition({ id: n.id, ...pos, width, height }, boxes);
    const box = { id: n.id, ...pos, width, height };
    boxes.push(box);
    nodes.push({
      ...n,
      position: pos,
      width,
      height,
      style: { width, height },
      data: {
        ...n.data,
        ports: [],
        layoutWidth: width,
        layoutHeight: height,
        notation,
      },
    });
  };
  for (const e of graph.entities) {
    const fields = attributeRows(e.attributes);
    const fks =
      compiled.schema.tables
        .find((t) => t.name === e.name)
        ?.columns.filter((c) => !c.sourceAttributeId && !c.internal) ?? [];
    const width =
      notation === "chen"
        ? Math.max(220, Math.min(360, e.name.length * 9 + 70))
        : Math.min(
            680,
            Math.max(
              400,
              ...fields.map(
                (r) => r.attribute.name.length * 7 + 155 + r.depth * 15,
              ),
              ...fks.map((c) => c.name.length * 7 + 145),
            ),
          );
    const height =
      notation === "chen"
        ? 64
        : 130 +
          fields.reduce(
            (sum, r) =>
              sum +
              Math.max(
                38,
                Math.ceil(
                  r.attribute.name.length /
                    Math.max(16, Math.floor((width - 165 - r.depth * 15) / 7)),
                ) *
                  20 +
                  10,
              ),
            0,
          ) +
          fks.reduce(
            (sum, c) =>
              sum +
              Math.max(
                38,
                Math.ceil(
                  c.name.length / Math.max(16, Math.floor((width - 165) / 7)),
                ) *
                  20 +
                  10,
              ),
            0,
          );
    add(
      {
        id: e.id,
        type: "entity",
        position: e.position,
        data: { entity: e, foreignColumns: fks },
        selected: selection?.id === e.id || multi.includes(e.id),
        dragHandle: ".entity-drag",
      },
      width,
      height,
      notation === "chen",
    );
  }
  for (const r of graph.relationships) {
    const [a, b] = r.endpoints;
    if (!a || !b) continue;
    const data: ERLinkData = {
      label: r.name,
      start: a.participation,
      end: b.participation,
      identifying: r.type === "identifying",
      uml: notation === "uml",
      relationshipId: r.id,
      cardinality: relationshipCardinality(r.endpoints),
    };
    {
      const ea = boxes.find((n) => n.id === a.entityId),
        eb = boxes.find((n) => n.id === b.entityId);
      add(
        {
          id: r.id,
          type: "relationship",
          position: r.position ?? {
            x: ((ea?.x ?? 0) + (eb?.x ?? 500)) / 2 + 170,
            y: ((ea?.y ?? 0) + (eb?.y ?? 0)) / 2 + 120,
          },
          data: { relationship: r },
          selected: selection?.id === r.id,
        },
        Math.min(380, Math.max(240, r.name.length * 7 + 110)),
        Math.max(150, Math.ceil(r.name.length / 22) * 26 + 80),
        true,
      );
      r.endpoints.forEach((p, i) => {
        const other = r.endpoints.filter((_, j) => j !== i);
        const owner =
          graph.entities.find((e) => e.id === p.entityId)?.name ?? p.role;
        const otherName = other
          .map(
            (p) =>
              graph.entities.find((e) => e.id === p.entityId)?.name ?? p.role,
          )
          .join(" + ");
        const count =
          r.endpoints.length === 2 ? other[0].participation : p.participation;
        edges.push({
          id: r.id + "-" + i,
          source: p.entityId,
          target: r.id,
          type: notation === "chen" ? "chen" : "crow",
          data: {
            ...data,
            start: p.participation,
            end: p.participation,
            endpoint: true,
            endpointName: owner,
            mandatory: totalParticipation(r.endpoints, i),
            label: `Per ${otherName}: ${participationLabel(p.participation)} ${owner}`,
          },
          selected: selection?.id === r.id,
        });
      });
    }
  }
  for (const s of graph.specializations) {
    add(
      {
        id: s.id,
        type: "isa",
        position: s.position,
        data: { specialization: s },
        selected: selection?.id === s.id,
      },
      130,
      80,
      notation === "chen",
    );
    edges.push({
      id: s.id + "-parent",
      source: s.superclassId,
      target: s.id,
      type: "chen",
      data: {
        label:
          s.completeness === "total"
            ? "Total specialization"
            : "Partial specialization",
        start: { min: 0, max: 1 },
        end: { min: 0, max: 1 },
        identifying: false,
        mandatory: s.completeness === "total",
        specializationId: s.id,
      },
    });
    for (const id of s.subclassIds)
      edges.push({
        id: s.id + "-" + id,
        source: s.id,
        target: id,
        type: "chen",
        data: {
          label: "Subclass",
          start: { min: 0, max: 1 },
          end: { min: 0, max: 1 },
          identifying: false,
          specializationId: s.id,
        },
      });
  }
  {
    const attrs = (list: Attribute[], parentId: string, ownerId: string) => {
      const parent = boxes.find((b) => b.id === parentId);
      if (!parent) return;
      list.forEach((a, i) => {
        const width = Math.max(180, Math.min(260, a.name.length * 8 + 40)),
          height = 70;
        add(
          {
            id: a.id,
            type: "attribute",
            position: {
              x: parent.x + (i % 3) * (width + 45) - width,
              y: parent.y - 135 - Math.floor(i / 3) * 120,
            },
            data: {
              attribute: a,
              ownerId,
              ownerColor: graph.entities.find((e) => e.id === ownerId)?.color,
            },
            draggable: true,
            selectable: true,
          },
          width,
          height,
          true,
        );
        edges.push({
          id: "attribute-" + a.id,
          source: parentId,
          target: a.id,
          type: "chen",
          data: {
            label: "",
            start: { min: 0, max: 1 },
            end: { min: 0, max: 1 },
            identifying: false,
            attributeLink: true,
          },
        });
        if (a.compositeChildren?.length)
          attrs(a.compositeChildren, a.id, ownerId);
      });
    };
    if (notation === "chen")
      for (const e of graph.entities) attrs(e.attributes, e.id, e.id);
    for (const r of graph.relationships)
      if (nodes.some((n) => n.id === r.id)) attrs(r.attributes, r.id, r.id);
  }
  const map = new Map(boxes.map((b) => [b.id, b]));
  const assignments = new Map<string, Port[]>();
  for (const edge of edges) {
    const a = map.get(edge.source),
      b = map.get(edge.target);
    if (!a || !b) continue;
    const [as, bs] = facing(a, b);
    const sp: Port = {
        id: edge.id + "-source",
        side: as,
        type: "source",
        fraction: 0.5,
      },
      tp: Port = {
        id: edge.id + "-target",
        side: bs,
        type: "target",
        fraction: 0.5,
      };
    assignments.set(a.id, [...(assignments.get(a.id) ?? []), sp]);
    assignments.set(b.id, [...(assignments.get(b.id) ?? []), tp]);
    edge.sourceHandle = sp.id;
    edge.targetHandle = tp.id;
  }
  const expanded: Box[] = [];
  for (const n of nodes) {
    const ports = assignments.get(n.id) ?? [];
    for (const side of ["left", "right", "top", "bottom"]) {
      const group = ports
        .filter((p) => p.side === side)
        .sort((a, b) => {
          const opposite = (p: Port) => {
            const edge = edges.find(
              (e) => e.sourceHandle === p.id || e.targetHandle === p.id,
            );
            const other =
              edge && map.get(p.type === "source" ? edge.target : edge.source);
            return other
              ? side === "left" || side === "right"
                ? other.y + other.height / 2
                : other.x + other.width / 2
              : 0;
          };
          return opposite(a) - opposite(b) || a.id.localeCompare(b.id);
        });
      const box = map.get(n.id)!;
      if (side === "left" || side === "right")
        box.height = Math.max(box.height, (group.length + 1) * 22);
      else box.width = Math.max(box.width, (group.length + 1) * 22);
      group.forEach((p, i) => (p.fraction = (i + 1) / (group.length + 1)));
    }
    const box = map.get(n.id)!;
    if (notation === "chen" && !layouts[n.id]) {
      const pos = freePosition(box, expanded);
      box.x = pos.x;
      box.y = pos.y;
    }
    expanded.push(box);
    n.position = { x: box.x, y: box.y };
    n.width = box.width;
    n.height = box.height;
    n.style = { width: box.width, height: box.height };
    n.data.layoutWidth = box.width;
    n.data.layoutHeight = box.height;
    n.data.ports = ports;
  }
  // Align facing ports on their common span rather than adding tiny doglegs.
  for (const edge of edges) {
    const a = map.get(edge.source),
      b = map.get(edge.target);
    if (!a || !b || a.id === b.id) continue;
    const sp = assignments.get(a.id)!.find((p) => p.id === edge.sourceHandle)!,
      tp = assignments.get(b.id)!.find((p) => p.id === edge.targetHandle)!;
    const horizontal =
      (sp.side === "left" && tp.side === "right") ||
      (sp.side === "right" && tp.side === "left");
    const vertical =
      (sp.side === "top" && tp.side === "bottom") ||
      (sp.side === "bottom" && tp.side === "top");
    if (!horizontal && !vertical) continue;
    const lo = Math.max(horizontal ? a.y : a.x, horizontal ? b.y : b.x) + 18;
    const hi =
      Math.min(
        horizontal ? a.y + a.height : a.x + a.width,
        horizontal ? b.y + b.height : b.x + b.width,
      ) - 18;
    if (lo > hi) continue;
    const p = portPoint(a, sp),
      q = portPoint(b, tp);
    const shared = Math.max(
      lo,
      Math.min(hi, horizontal ? (p.y + q.y) / 2 : (p.x + q.x) / 2),
    );
    const available = (box: Box, port: Port) =>
      !assignments
        .get(box.id)!
        .some(
          (other) =>
            other !== port &&
            other.side === port.side &&
            Math.abs(
              (horizontal ? portPoint(box, other).y : portPoint(box, other).x) -
                shared,
            ) < 20,
        );
    if (available(a, sp) && available(b, tp)) {
      sp.fraction =
        (shared - (horizontal ? a.y : a.x)) / (horizontal ? a.height : a.width);
      tp.fraction =
        (shared - (horizontal ? b.y : b.x)) / (horizontal ? b.height : b.width);
    }
  }
  const previous: ReturnType<typeof route>[] = [];
  const labelBoxes: Box[] = [];
  for (const edge of edges) {
    const a = map.get(edge.source),
      b = map.get(edge.target);
    if (!a || !b) continue;
    const sp = assignments.get(a.id)!.find((p) => p.id === edge.sourceHandle)!,
      tp = assignments.get(b.id)!.find((p) => p.id === edge.targetHandle)!;
    const points = route(
      portPoint(a, sp),
      portPoint(b, tp),
      sp.side,
      tp.side,
      [...boxes, ...labelBoxes],
      previous,
    );
    // Diamond attachments meet the polygon instead of stopping at its bounding box.
    const diamondAnchor = (box: Box, port: Port) => {
      const p = portPoint(box, port);
      if (!nodes.some((n) => n.id === box.id && n.type === "relationship"))
        return p;
      if (port.side === "left" || port.side === "right")
        p.x =
          box.x +
          box.width / 2 +
          (((port.side === "right" ? 1 : -1) * box.width) / 2) *
            (1 - Math.abs(2 * port.fraction - 1));
      else
        p.y =
          box.y +
          box.height / 2 +
          (((port.side === "bottom" ? 1 : -1) * box.height) / 2) *
            (1 - Math.abs(2 * port.fraction - 1));
      return p;
    };
    points[0] = diamondAnchor(a, sp);
    points[points.length - 1] = diamondAnchor(b, tp);
    edge.data = { ...edge.data!, points };
    if (!edge.data.attributeLink && edge.data.label) {
      const anchor = labelPoint(points);
      const box = placeLabel(
        "label-" + edge.id,
        anchor,
        boxes,
        labelBoxes,
        previous,
      );
      labelBoxes.push(box);
      edge.data.labelPosition = {
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
      };
      edge.data.labelAnchor = anchor;
    }
    previous.push(points);
  }
  for (const set of graph.entitySets ?? []) {
    const ids = new Set([...set.entityIds, set.relationshipId]);
    const members = nodes.filter(
      (n) => ids.has(n.id) || ids.has(String(n.data.ownerId)),
    );
    if (!members.length) continue;
    const x = Math.min(...members.map((n) => n.position.x)) - 35,
      y = Math.min(...members.map((n) => n.position.y)) - 65;
    const width =
      Math.max(...members.map((n) => n.position.x + (n.width ?? 0))) - x + 35;
    const height =
      Math.max(...members.map((n) => n.position.y + (n.height ?? 0))) - y + 35;
    nodes.unshift({
      id: set.id,
      type: "entitySet",
      position: { x, y },
      width,
      height,
      style: { width, height },
      data: { label: set.name },
      zIndex: -1,
      dragHandle: ".set-drag",
    });
  }
  return { nodes, edges };
}
