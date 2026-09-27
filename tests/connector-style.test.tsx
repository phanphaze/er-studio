import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { it, expect, vi } from "vitest";
import type { EdgeProps } from "@xyflow/react";
const settings = vi.hoisted(() => ({ cardinalityDisplay: "words" }));
vi.mock("@/store/useSettingsStore", () => ({
  useSettingsStore: (selector: (s: typeof settings) => unknown) =>
    selector(settings),
}));
vi.mock("@xyflow/react", () => ({
  getSmoothStepPath: () => ["M 0 0 L 200 0", 100, 0],
  BaseEdge: ({
    path,
    markerStart,
    markerEnd,
  }: {
    path: string;
    markerStart?: string;
    markerEnd?: string;
  }) => (
    <path
      data-testid="connector"
      d={path}
      markerStart={markerStart}
      markerEnd={markerEnd}
    />
  ),
  EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));
import { CrowsFootEdge } from "../src/components/canvas/edges/CrowsFootEdge";
import { ChenEdge } from "../src/components/canvas/edges/ChenEdge";
it("the selected style changes actual line marker attachments and glyphs in all three views", () => {
  for (const view of ["chen", "crow", "uml"]) {
    const Component = view === "chen" ? ChenEdge : CrowsFootEdge;
    const props = {
      id: "test",
      selected: false,
      data: {
        label: "owns",
        endpoint: true,
        uml: view === "uml",
        start: { min: 0, max: "*" },
        end: { min: 1, max: 1 },
        identifying: false,
      },
    } as unknown as EdgeProps;
    settings.cardinalityDisplay = "arrows";
    let html = renderToStaticMarkup(<Component {...props} />);
    expect(html).toContain('marker-start="url(#test-s)"');
    expect(html).toContain("M 18,-7 L 29,0 L 18,7");
    expect(html).toContain("M 8,-7 L 19,0 L 8,7");
    settings.cardinalityDisplay = "crow";
    html = renderToStaticMarkup(<Component {...props} />);
    expect(html).toContain('marker-start="url(#test-s)"');
    expect(html).toContain("M 29,-7 L 15,0 L 29,7 M 29,0 H 15");
    expect(html).not.toContain("M 18,-7");
    for (const style of ["words", "minmax", "dots"]) {
      settings.cardinalityDisplay = style;
      html = renderToStaticMarkup(<Component {...props} />);
      expect(html).not.toContain("marker-start=");
      expect(html).not.toContain("<marker");
    }
  }
});
