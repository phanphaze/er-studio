"use client";
import { useState } from "react";
import type { Rect } from "@xyflow/react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { pngDimensions } from "@/lib/export/diagramPng";
export function PngExportDialog({
  bounds,
  onClose,
  onExport,
}: {
  bounds: Rect | null;
  onClose: () => void;
  onExport: (scale: number) => Promise<void>;
}) {
  const [scale, setScale] = useState(4);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const size = bounds ? pngDimensions(bounds, scale) : null;
  return (
    <Dialog
      open={!!bounds}
      onOpenChange={(open) => {
        if (!open && !busy) {
          onClose();
          setError("");
        }
      }}
    >
      <DialogContent>
        <DialogTitle>Export high-resolution PNG</DialogTitle>
        <DialogDescription>
          Downloads the entire diagram, including items outside your view. Your
          current zoom does not affect image quality.
        </DialogDescription>
        <label className="field-label">
          Resolution
          <select
            value={scale}
            disabled={busy}
            onChange={(e) => {
              setScale(Number(e.target.value));
              setError("");
            }}
          >
            {[1, 2, 4, 8].map((value) => (
              <option key={value} value={value}>
                {value}×{" "}
                {value === 4
                  ? "— High resolution"
                  : value === 8
                    ? "— Ultra resolution"
                    : value === 2
                      ? "— Standard"
                      : "— Native size"}
              </option>
            ))}
          </select>
        </label>
        {size && (
          <p className="muted">
            {size.width.toLocaleString()} × {size.height.toLocaleString()}{" "}
            pixels
          </p>
        )}
        {size && !size.supported && (
          <p role="alert">
            This image exceeds 16,384 pixels per side or 64 megapixels. Choose a
            lower resolution; exports are never silently shrunk.
          </p>
        )}
        <p className="muted">
          4× makes a 12px diagram label approximately 48 pixels tall in the
          image. Higher resolutions take more memory and time.
        </p>
        {error && <p role="alert">{error}</p>}
        <Button
          disabled={busy || !size?.supported}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await onExport(scale);
              onClose();
            } catch (cause) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : "PNG export failed. Try a lower resolution.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Rendering PNG…" : "Download PNG"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
