"use client";
import * as Menu from "@radix-ui/react-context-menu";
import { useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useERStore } from "@/store/useERStore";
import type { Point } from "@/lib/ast/types";
export function CanvasMenu({
  children,
  toPoint,
}: {
  children: ReactNode;
  toPoint: (p: Point) => Point;
}) {
  const graph = useERStore((s) => s.graph);
  const selected = useERStore((s) => s.selectedIds);
  const [point, setPoint] = useState<Point>({ x: 0, y: 0 });
  const [target, setTarget] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("relationship");
  const [participants, setParticipants] = useState<string[]>([]);
  const relation = graph.relationships.find((r) => r.id === target);
  const insert = (type: "regular" | "weak" | "associative") => {
    const s = useERStore.getState();
    s.beginTransaction();
    const id = s.addEntity("untitled", point);
    s.updateEntity(id, { type });
    s.endTransaction();
  };
  return (
    <>
      <Menu.Root>
        <Menu.Trigger asChild>
          <div
            className="canvas-menu-root"
            onContextMenu={(e) => {
              setPoint(toPoint({ x: e.clientX, y: e.clientY }));
              const el = (e.target as HTMLElement).closest("[data-id]");
              const id = el?.getAttribute("data-id") ?? "";
              setTarget(id);
              if (
                id &&
                !selected.includes(id) &&
                [
                  ...graph.entities,
                  ...graph.relationships,
                  ...(graph.entitySets ?? []),
                ].some((n) => n.id === id)
              )
                useERStore.setState({ selectedIds: [id] });
            }}
          >
            {children}
          </div>
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Content className="attribute-context-menu">
            <Menu.Label>Insert at cursor</Menu.Label>
            <Menu.Item onSelect={() => insert("regular")}>
              Entity / table
            </Menu.Item>
            <Menu.Item onSelect={() => insert("weak")}>Weak entity</Menu.Item>
            <Menu.Item onSelect={() => insert("associative")}>
              Associative entity
            </Menu.Item>
            <Menu.Item
              disabled={graph.entities.length < 2}
              onSelect={() => {
                setParticipants(
                  graph.entities
                    .filter((e) => selected.includes(e.id))
                    .map((e) => e.id),
                );
                setName("relationship");
                setOpen(true);
              }}
            >
              Relationship…
            </Menu.Item>
            {relation && (
              <Menu.Item
                onSelect={() =>
                  useERStore.getState().aggregateRelationship(relation.id)
                }
              >
                Create entity set with participants
              </Menu.Item>
            )}
            <Menu.Separator />
            <Menu.Item
              disabled={!selected.length}
              className="delete-item"
              onSelect={() => useERStore.getState().deleteSelected()}
            >
              Delete selected items
            </Menu.Item>
          </Menu.Content>
        </Menu.Portal>
      </Menu.Root>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Insert relationship</DialogTitle>
          <DialogDescription>
            Select two participants, or three or more for an n-ary relationship.
          </DialogDescription>
          <label className="field-label">
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="participant-picker">
            {graph.entities.map((e) => (
              <label key={e.id} className="digits-check">
                <input
                  type="checkbox"
                  checked={participants.includes(e.id)}
                  onChange={(ev) =>
                    setParticipants((p) =>
                      ev.target.checked
                        ? [...p, e.id]
                        : p.filter((id) => id !== e.id),
                    )
                  }
                />
                {e.name}
              </label>
            ))}
          </div>
          <Button
            disabled={participants.length < 2 || !name.trim()}
            onClick={() => {
              useERStore
                .getState()
                .addRelationship({
                  name: name.trim(),
                  type: participants.length > 2 ? "n-ary" : "non-identifying",
                  cardinality: "M:N",
                  position: point,
                  endpoints: participants.map((id, i) => ({
                    entityId: id,
                    role:
                      graph.entities.find((e) => e.id === id)!.name +
                      "_" +
                      (i + 1),
                    participation: { min: 0, max: "*" },
                  })),
                  attributes: [],
                  onDelete: "RESTRICT",
                  onUpdate: "CASCADE",
                });
              setOpen(false);
            }}
          >
            Create relationship
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
