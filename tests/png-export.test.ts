import { it, expect, vi, afterEach } from "vitest";
import { pngDimensions, exportDiagramPng } from "../src/lib/export/diagramPng";
const toBlob = vi.hoisted(() =>
  vi.fn(async () => new Blob(["png"], { type: "image/png" })),
);
vi.mock("html-to-image", () => ({ toBlob }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("scales the entire diagram at the requested resolution without downsampling", () => {
  const bounds = { x: -1000, y: 500, width: 3000, height: 1000 };
  expect(pngDimensions(bounds, 4)).toEqual({
    width: 14080,
    height: 6080,
    supported: false,
  });
  expect(pngDimensions(bounds, 2)).toEqual({
    width: 7040,
    height: 3040,
    supported: true,
  });
  expect(() => pngDimensions(bounds, 3)).toThrow();
});
it("renders offscreen content at explicit pixel dimensions and downloads a PNG blob", async () => {
  vi.useFakeTimers();
  const link = { href: "", download: "", click: vi.fn(), remove: vi.fn() };
  vi.stubGlobal("document", {
    fonts: { ready: Promise.resolve() },
    documentElement: {},
    createElement: () => link,
    body: { appendChild: vi.fn() },
  });
  vi.stubGlobal("getComputedStyle", () => ({
    getPropertyValue: () => "#ffffff",
  }));
  const revoke = vi.fn();
  vi.stubGlobal("URL", {
    createObjectURL: () => "blob:test",
    revokeObjectURL: revoke,
  });
  await exportDiagramPng(
    {} as HTMLElement,
    { x: -100, y: 200, width: 1000, height: 500 },
    "My diagram",
    4,
  );
  expect(toBlob).toHaveBeenCalledWith(
    {},
    expect.objectContaining({
      canvasWidth: 6080,
      canvasHeight: 4080,
      pixelRatio: 1,
      skipAutoScale: true,
      style: expect.objectContaining({
        transform: "translate(360px, 60px) scale(1)",
      }),
    }),
  );
  expect(link.download).toBe("My diagram-4x.png");
  expect(link.click).toHaveBeenCalledOnce();
  vi.runAllTimers();
  expect(revoke).toHaveBeenCalledWith("blob:test");
});
it("rejects oversized images before attempting rendering", async () => {
  await expect(
    exportDiagramPng(
      {} as HTMLElement,
      { x: 0, y: 0, width: 20000, height: 1000 },
      "Huge",
      1,
    ),
  ).rejects.toThrow("lower resolution");
});
