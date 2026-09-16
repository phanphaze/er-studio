/** Framework-independent, versioned ER abstract syntax tree. Endpoint bounds describe
 * how many instances of that endpoint may relate to one opposite instance. */
export type ID = string;
export type Notation = "crows-foot" | "chen" | "uml";
export type EntityType = "regular" | "weak" | "associative";
export type RelationshipType =
  "identifying" | "non-identifying" | "recursive" | "isa" | "n-ary";
export type Cardinality = "1:1" | "1:N" | "M:N";
export type DataType =
  | "uuid"
  | "text"
  | "varchar(255)"
  | "integer"
  | "bigint"
  | "numeric(12,2)"
  | "boolean"
  | "time"
  | "date"
  | "timestamptz"
  | "jsonb";
export const DATA_TYPES: readonly DataType[] = [
  "uuid",
  "text",
  "varchar(255)",
  "integer",
  "bigint",
  "numeric(12,2)",
  "boolean",
  "time",
  "date",
  "timestamptz",
  "jsonb",
];
export interface Attribute {
  id: ID;
  name: string;
  type: DataType;
  isPrimaryKey: boolean;
  isPartialKey: boolean;
  isNullable: boolean;
  isUnique: boolean;
  isDerived: boolean;
  isMultivalued: boolean;
  minLength?: number;
  maxLength?: number;
  digitsOnly?: boolean;
  preset?: "address";
  compositeChildren?: Attribute[];
  check?: { operator: ">" | ">=" | "<" | "<=" | "=" | "<>"; value: number };
}
export interface Point {
  x: number;
  y: number;
}
export interface Entity {
  id: ID;
  name: string;
  type: EntityType;
  attributes: Attribute[];
  position: Point;
  color: string;
}
export interface Participation {
  min: number;
  max: number | "*";
}
export interface RelationshipEndpoint {
  entityId: ID;
  role: string;
  participation: Participation;
  attributeId?: ID;
  entityParticipation?: "total" | "partial";
}
export type ReferentialAction =
  "CASCADE" | "RESTRICT" | "NO ACTION" | "SET NULL";
export interface Relationship {
  id: ID;
  name: string;
  type: RelationshipType;
  cardinality: Cardinality;
  endpoints: RelationshipEndpoint[];
  attributes: Attribute[];
  /** Required for identifying relationships. */ ownerEntityId?: ID;
  /** Referencing endpoint index for 1:1; for 1:N inferred from bounds. */ foreignKeyEndpoint?: number;
  onDelete: ReferentialAction;
  onUpdate: ReferentialAction;
  foreignKeyNames?: Record<string, string>;
  position?: Point;
}
export type InheritanceStrategy = "table-per-type" | "table-per-hierarchy";
export interface Specialization {
  id: ID;
  name: string;
  superclassId: ID;
  subclassIds: ID[];
  disjointness: "disjoint" | "overlapping";
  completeness: "total" | "partial";
  strategy: InheritanceStrategy;
  position: Point;
}
export interface ERGraph {
  layouts?: Partial<Record<Notation, Record<ID, Point>>>;
  version: 1;
  name: string;
  entities: Entity[];
  relationships: Relationship[];
  specializations: Specialization[];
}
export interface RelationalColumn {
  internal?: boolean;
  name: string;
  type: DataType;
  nullable: boolean;
  sourceAttributeId?: ID;
  sourceRelationshipId?: ID;
  generatedName?: string;
}
export interface ForeignKey {
  name: string;
  columns: string[];
  referencedTable: string;
  referencedColumns: string[];
  onDelete: ReferentialAction;
  onUpdate: ReferentialAction;
}
export interface RelationalTable {
  boundedCardinalities?: { columns: string[]; max: number; slot: string }[];
  name: string;
  columns: RelationalColumn[];
  primaryKey: string[];
  uniqueConstraints: string[][];
  foreignKeys: ForeignKey[];
  checks: string[];
}
export interface RelationalSchema {
  tables: RelationalTable[];
  warnings: string[];
}
export interface ValidationIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  elementId?: ID;
}
export interface CompilationResult {
  schema: RelationalSchema;
  sql: string;
  issues: ValidationIssue[];
}
export type Selection = {
  kind: "entity" | "relationship" | "specialization";
  id: ID;
} | null;
