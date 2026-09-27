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
/** Move a whole subtree one level, preserving IDs, flags, and connection anchors. */
export function changeAttributeDepth(
  attributes: Attribute[],
  id: string,
  direction: "indent" | "outdent",
): boolean {
  const row = attributeRows(attributes).find((r) => r.attribute.id === id);
  const siblings = attributeSiblings(attributes, id);
  if (!row || !siblings) return false;
  if (direction === "indent") {
    if (row.index === 0) return false;
    const parent = siblings[row.index - 1];
    if (parent.compositeChildren?.some((a) => a.name === row.attribute.name))
      return false;
    const [moving] = siblings.splice(row.index, 1);
    delete parent.minLength;
    delete parent.maxLength;
    delete parent.digitsOnly;
    (parent.compositeChildren ??= []).push(moving);
    return true;
  }
  if (!row.parentId) return false;
  const outer = attributeSiblings(attributes, row.parentId);
  if (!outer || outer.some((a) => a.name === row.attribute.name)) return false;
  const parentIndex = outer.findIndex((a) => a.id === row.parentId);
  const [moving] = siblings.splice(row.index, 1);
  outer.splice(parentIndex + 1, 0, moving);
  if (!siblings.length) delete outer[parentIndex].compositeChildren;
  return true;
}
