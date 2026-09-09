import { z } from "zod";
import { DATA_TYPES, type Attribute, type ERGraph } from "./types";
const id = z.string().min(1).max(128);
const point = z.object({ x: z.number().finite(), y: z.number().finite() });
const attribute: z.ZodType<Attribute> = z.lazy(() =>
  z.object({
    id,
    name: z.string().max(256),
    type: z.enum(DATA_TYPES),
    isPrimaryKey: z.boolean(),
    isPartialKey: z.boolean(),
    isNullable: z.boolean(),
    isUnique: z.boolean(),
    isDerived: z.boolean(),
    isMultivalued: z.boolean(),
    minLength: z.number().int().min(0).max(1000000).optional(),
    maxLength: z.number().int().min(0).max(1000000).optional(),
    digitsOnly: z.boolean().optional(),
    preset: z.literal("address").optional(),
    compositeChildren: z.array(attribute).max(250).optional(),
    check: z
      .object({
        operator: z.enum([">", ">=", "<", "<=", "=", "<>"]),
        value: z.number().finite(),
      })
      .optional(),
  }),
);
const action = z.enum(["CASCADE", "RESTRICT", "NO ACTION", "SET NULL"]);
const model = z.object({
  version: z.literal(1),
  name: z.string().max(256),
  entities: z
    .array(
      z.object({
        id,
        name: z.string().max(256),
        type: z.enum(["regular", "weak", "associative"]),
        attributes: z.array(attribute).max(250),
        position: point,
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      }),
    )
    .max(1000),
  relationships: z
    .array(
      z.object({
        id,
        name: z.string().max(256),
        type: z.enum([
          "identifying",
          "non-identifying",
          "recursive",
          "isa",
          "n-ary",
        ]),
        cardinality: z.enum(["1:1", "1:N", "M:N"]),
        endpoints: z
          .array(
            z.object({
              entityId: id,
              role: z.string().max(256),
              participation: z.object({
                min: z.union([z.literal(0), z.literal(1)]),
                max: z.union([z.literal(1), z.literal("*")]),
              }),
              attributeId: id.optional(),
            }),
          )
          .max(100),
        attributes: z.array(attribute).max(250),
        foreignKeyNames: z
          .record(z.string().max(256), z.string().min(1).max(63))
          .optional(),
        ownerEntityId: id.optional(),
        foreignKeyEndpoint: z.number().int().min(0).max(1).optional(),
        onDelete: action,
        onUpdate: action,
        position: point.optional(),
      }),
    )
    .max(3000),
  specializations: z
    .array(
      z.object({
        id,
        name: z.string().max(256),
        superclassId: id,
        subclassIds: z.array(id).max(1000),
        disjointness: z.enum(["disjoint", "overlapping"]),
        completeness: z.enum(["total", "partial"]),
        strategy: z.enum(["table-per-type", "table-per-hierarchy"]),
        position: point,
      }),
    )
    .max(1000),
});
/** Parse untrusted model files before they reach the store. Semantic errors remain
 * editable and appear in the validation inspector. Bound size and nesting first. */
export function parseModel(text: string): ERGraph {
  if (text.length > 5_000_000) throw Error("Model exceeds the 5 MB limit.");
  const input: unknown = JSON.parse(text);
  const queue: { value: unknown; depth: number }[] = [
    { value: input, depth: 0 },
  ];
  for (let i = 0; i < queue.length; i++) {
    const { value, depth } = queue[i];
    if (depth > 24) throw Error("Model nesting exceeds the supported depth.");
    if (value && typeof value === "object")
      for (const child of Object.values(value))
        queue.push({ value: child, depth: depth + 1 });
  }
  const result = model.safeParse(input);
  if (!result.success)
    throw Error("Invalid ER model file: " + result.error.issues[0]?.message);
  return result.data;
}
