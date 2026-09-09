import type { Rect } from "@xyflow/react";
/** Capture the complete flow viewport independently of pan/zoom. Padding includes
 * relationship labels and self-loop curves extending beyond node rectangles. */
export async function exportDiagramPdf(
  viewport: HTMLElement,
  bounds: Rect,
  name: string,
) {
  const [{ toPng }, { jsPDF }] = await Promise.all([
    import("html-to-image"),
    import("jspdf"),
  ]);
  await document.fonts.ready;
  const padding = 260;
  const fullWidth = bounds.width + padding * 2,
    fullHeight = bounds.height + padding * 2;
  const scale = Math.min(2, 3600 / Math.max(fullWidth, fullHeight));
  const width = Math.ceil(fullWidth * scale),
    height = Math.ceil(fullHeight * scale);
  const data = await toPng(viewport, {
    width,
    height,
    pixelRatio: 1,
    backgroundColor:
      getComputedStyle(document.documentElement)
        .getPropertyValue("--canvas-surface")
        .trim() || "#0d1017",
    cacheBust: false,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${(-bounds.x + padding) * scale}px, ${(-bounds.y + padding) * scale}px) scale(${scale})`,
      transformOrigin: "0 0",
    },
    filter: (node) =>
      !(
        node instanceof HTMLElement &&
        (node.classList.contains("react-flow__node-toolbar") ||
          node.classList.contains("edge-actions"))
      ),
  });
  const pdf = new jsPDF({
    orientation: width >= height ? "landscape" : "portrait",
    unit: "mm",
    format: "a3",
    compress: true,
  });
  const pageWidth = pdf.internal.pageSize.getWidth(),
    pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 12;
  pdf.setFontSize(16);
  pdf.text(name.replace(/[^\x20-\x7E]/g, "?"), margin, 18);
  pdf.setFontSize(9);
  pdf.setTextColor(100);
  pdf.text("ER Studio | Complete diagram", margin, 25);
  const fit = Math.min(
    (pageWidth - margin * 2) / width,
    (pageHeight - 40) / height,
  );
  const drawW = width * fit,
    drawH = height * fit;
  pdf.addImage(
    data,
    "PNG",
    (pageWidth - drawW) / 2,
    32,
    drawW,
    drawH,
    undefined,
    "FAST",
  );
  pdf.setProperties({
    title: name,
    subject: "Entity relationship diagram",
    creator: "ER Studio",
  });
  pdf.save((name.replace(/[^a-zA-Z0-9 _-]/g, "").trim() || "diagram") + ".pdf");
}
