import type { Attribute, DataType, ERGraph } from "@/lib/ast/types";
export const attribute = (
  id: string,
  name: string,
  type: DataType = "text",
  key = false,
): Attribute => ({
  id,
  name,
  type,
  isPrimaryKey: key,
  isPartialKey: false,
  isNullable: false,
  isUnique: false,
  isDerived: false,
  isMultivalued: false,
});
export const seedGraph: ERGraph = {
  version: 1,
  name: "Commerce workspace",
  entities: [
    {
      id: "customers",
      name: "customers",
      type: "regular",
      color: "#a78bfa",
      position: { x: 80, y: 90 },
      attributes: [
        attribute("c-id", "id", "uuid", true),
        attribute("c-email", "email", "varchar(255)"),
        attribute("c-name", "full_name"),
        attribute("c-created", "created_at", "timestamptz"),
      ],
    },
    {
      id: "orders",
      name: "orders",
      type: "regular",
      color: "#60a5fa",
      position: { x: 510, y: 140 },
      attributes: [
        attribute("o-id", "id", "uuid", true),
        attribute("o-status", "status"),
        {
          ...attribute("o-total", "total", "numeric(12,2)"),
          check: { operator: ">=", value: 0 },
        },
        attribute("o-created", "created_at", "timestamptz"),
      ],
    },
    {
      id: "products",
      name: "products",
      type: "regular",
      color: "#34d399",
      position: { x: 950, y: 90 },
      attributes: [
        attribute("p-id", "id", "uuid", true),
        attribute("p-name", "name"),
        attribute("p-price", "price", "numeric(12,2)"),
        attribute("p-sku", "sku", "varchar(255)"),
      ],
    },
    {
      id: "payments",
      name: "payments",
      type: "regular",
      color: "#fbbf24",
      position: { x: 510, y: 550 },
      attributes: [
        attribute("pay-id", "id", "uuid", true),
        attribute("pay-amount", "amount", "numeric(12,2)"),
        attribute("pay-method", "method"),
        attribute("pay-time", "paid_at", "timestamptz"),
      ],
    },
  ],
  relationships: [
    {
      id: "places",
      name: "places",
      type: "non-identifying",
      cardinality: "1:N",
      endpoints: [
        {
          entityId: "customers",
          role: "customer",
          participation: { min: 1, max: 1 },
        },
        {
          entityId: "orders",
          role: "orders",
          participation: { min: 0, max: "*" },
        },
      ],
      attributes: [],
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    {
      id: "order-products",
      name: "order_items",
      type: "non-identifying",
      cardinality: "M:N",
      endpoints: [
        {
          entityId: "orders",
          role: "order",
          participation: { min: 0, max: "*" },
        },
        {
          entityId: "products",
          role: "product",
          participation: { min: 0, max: "*" },
        },
      ],
      attributes: [attribute("quantity", "quantity", "integer")],
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    {
      id: "order-payments",
      name: "settles",
      type: "non-identifying",
      cardinality: "1:N",
      endpoints: [
        {
          entityId: "orders",
          role: "order",
          participation: { min: 1, max: 1 },
        },
        {
          entityId: "payments",
          role: "payments",
          participation: { min: 0, max: "*" },
        },
      ],
      attributes: [],
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
  ],
  specializations: [],
};
