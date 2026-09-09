"use client";
import * as ContextMenu from "@radix-ui/react-context-menu";
import { Trash2, SlidersHorizontal } from "lucide-react";
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
