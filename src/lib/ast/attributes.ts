import type { Attribute } from "./types";
/** Preserve hierarchy while providing a stable display order and sibling index. */
export function attributeRows(
  attributes: Attribute[],
  depth = 0,
  parentId?: string,
): { attribute: Attribute; depth: number; index: number; parentId?: string }[] {
  return attributes.flatMap((attribute, index) => [
    { attribute, depth, index, parentId },
    ...attributeRows(
      attribute.compositeChildren ?? [],
      depth + 1,
      attribute.id,
    ),
  ]);
}
export function attributeSiblings(
  attributes: Attribute[],
  id: string,
): Attribute[] | undefined {
  if (attributes.some((a) => a.id === id)) return attributes;
  for (const a of attributes) {
    const found = attributeSiblings(a.compositeChildren ?? [], id);
    if (found) return found;
  }
}
