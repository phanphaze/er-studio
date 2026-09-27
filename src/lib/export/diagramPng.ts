import type { Rect } from "@xyflow/react";
export const PNG_PADDING = 260;
export function pngDimensions(bounds: Rect, scale: number) {
  if (![1, 2, 4, 8].includes(scale))
    throw Error("Choose a supported PNG resolution.");
  const width = Math.ceil((bounds.width + PNG_PADDING * 2) * scale);
  const height = Math.ceil((bounds.height + PNG_PADDING * 2) * scale);
  const supported =
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    width > 0 &&
    height > 0 &&
    width <= 16384 &&
    height <= 16384 &&
    width * height <= 64_000_000;
  return { width, height, supported };
}
export async function exportDiagramPng(
  viewport: HTMLElement,
  bounds: Rect,
  name: string,
  scale: number,
) {
  const size = pngDimensions(bounds, scale);
  if (!size.supported)
    throw Error(
      "This resolution exceeds the PNG size limit. Choose a lower resolution.",
    );
  const { toBlob } = await import("html-to-image");
  await document.fonts.ready;
  const width = Math.ceil(bounds.width + PNG_PADDING * 2);
  const height = Math.ceil(bounds.height + PNG_PADDING * 2);
  const blob = await toBlob(viewport, {
    width,
    height,
    canvasWidth: size.width,
    canvasHeight: size.height,
    pixelRatio: 1,
    skipAutoScale: true,
    backgroundColor:
      getComputedStyle(document.documentElement)
        .getPropertyValue("--canvas-surface")
        .trim() || "#0d1017",
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${-bounds.x + PNG_PADDING}px, ${-bounds.y + PNG_PADDING}px) scale(1)`,
      transformOrigin: "0 0",
    },
    filter: (node) =>
      !(
        node instanceof Element &&
        [
          "react-flow__handle",
          "react-flow__node-toolbar",
          "edge-actions",
          "entity-add-footer",
          "attribute-grip",
          "attribute-nest-grip",
        ].some((c) => node.classList.contains(c))
      ),
  });
  if (!blob || !blob.size)
    throw Error(
      "The browser could not create this image. Try a lower resolution.",
    );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download =
    (name.replace(/[^a-zA-Z0-9 _-]/g, "").trim() || "diagram") +
    `-${scale}x.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
