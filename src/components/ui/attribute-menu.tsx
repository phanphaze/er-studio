"use client";
import * as ContextMenu from "@radix-ui/react-context-menu";
import { Trash2, SlidersHorizontal } from "lucide-react";
import { attributeRows } from "@/lib/ast/attributes";
import { useERStore } from "@/store/useERStore";
export function AttributeMenu({
  ownerId,
  attributeId,
  hasChildren,
  children,
}: {
  ownerId: string;
  attributeId: string;
  hasChildren?: boolean;
  children: React.ReactNode;
}) {
  const owner = useERStore((s) =>
    [...s.graph.entities, ...s.graph.relationships].find(
      (o) => o.id === ownerId,
    ),
  );
  const row =
    owner &&
    attributeRows(owner.attributes).find((r) => r.attribute.id === attributeId);
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content
          className="attribute-context-menu"
          onClick={(e) => e.stopPropagation()}
        >
          <ContextMenu.Item
            onSelect={() =>
              useERStore.getState().focusAttribute(ownerId, attributeId)
            }
          >
            <SlidersHorizontal size={14} />
            Edit properties
          </ContextMenu.Item>
          <ContextMenu.Item
            onSelect={() =>
              useERStore.getState().addAttribute(ownerId, attributeId)
            }
          >
            Add composite child
          </ContextMenu.Item>
          <ContextMenu.Item
            disabled={!row || row.index === 0}
            onSelect={() =>
              useERStore
                .getState()
                .changeAttributeDepth(ownerId, attributeId, "indent")
            }
          >
            Nest under previous field
          </ContextMenu.Item>
          <ContextMenu.Item
            disabled={!row?.parentId}
            onSelect={() =>
              useERStore
                .getState()
                .changeAttributeDepth(ownerId, attributeId, "outdent")
            }
          >
            Move out one level
          </ContextMenu.Item>
          <ContextMenu.Item
            className="delete-item"
            onSelect={() => {
              const store = useERStore.getState();
              store.endTransaction();
              store.deleteAttribute(ownerId, attributeId);
            }}
          >
            <Trash2 size={14} />
            {hasChildren ? "Delete attribute and children" : "Delete attribute"}
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
