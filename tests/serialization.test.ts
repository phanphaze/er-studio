import { it, expect } from "vitest";
import { parseModel } from "../src/lib/ast/serialization";
import { seedGraph } from "../src/store/seed";
it("round-trips a versioned model and rejects malformed imports", () => {
  expect(parseModel(JSON.stringify(seedGraph))).toEqual(seedGraph);
  expect(() => parseModel('{"version":2}')).toThrow("Invalid ER model");
  expect(() => parseModel("[]")).toThrow("Invalid ER model");
});
it("bounds hostile nesting before recursive schema parsing", () => {
  let value: unknown = {};
  for (let i = 0; i < 30; i++) value = { nested: value };
  expect(() => parseModel(JSON.stringify(value))).toThrow("nesting");
});
