import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    graph: text("graph").notNull(),
    revision: integer("revision").notNull().default(1),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [index("projects_updated_idx").on(t.updatedAt)],
);
