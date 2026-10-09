import { expect, it } from "vitest";
import { seedGraph } from "../src/store/seed";
import { parseModel } from "../src/lib/ast/serialization";
import { projectGraph } from "../src/lib/layout/projection";
it("preserves relationship color through JSON and projects it onto every participating line", () => {
  const graph = structuredClone(seedGraph);
  graph.relationships[0].color = "#34d399";
  const restored = parseModel(JSON.stringify(graph));
  expect(restored.relationships[0].color).toBe("#34d399");
  for (const notation of ["chen", "uml", "crows-foot"] as const) {
    const projected = projectGraph(restored, notation, null);
    const links = projected.edges.filter(e => e.data?.relationshipId === restored.relationships[0].id);
    expect(links).toHaveLength(restored.relationships[0].endpoints.length);
    expect(links.every(e => e.data?.color === "#34d399")).toBe(true);
  }
});
