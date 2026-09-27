"use client";
import { useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { GripVertical } from "lucide-react";
import { useERStore } from "@/store/useERStore";
export function AttributeNestGrip({
  ownerId,
  attributeId,
}: {
  ownerId: string;
  attributeId: string;
}) {
  const origin = useRef<number | null>(null);
  const [delta, setDelta] = useState(0);
  const flow = useReactFlow();
  const move = (direction: "indent" | "outdent") =>
    useERStore.getState().changeAttributeDepth(ownerId, attributeId, direction);
  return (
    <button
      className="oval-nest-grip nodrag nopan"
      aria-label="Nest or unnest attribute"
      title="Drag right to nest under the previous field; left to unnest. Arrow keys also work."
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        origin.current = e.clientX;
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (origin.current !== null)
          setDelta((e.clientX - origin.current) / flow.getZoom());
      }}
      onPointerUp={(e) => {
        if (origin.current === null) return;
        if (delta > 32) move("indent");
        else if (delta < -32) move("outdent");
        origin.current = null;
        setDelta(0);
        e.currentTarget.releasePointerCapture(e.pointerId);
      }}
      onPointerCancel={() => {
        origin.current = null;
        setDelta(0);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          e.stopPropagation();
          move(e.key === "ArrowRight" ? "indent" : "outdent");
        }
      }}
    >
      <GripVertical size={14} />
      {Math.abs(delta) > 32 && (
        <span className="attribute-drag-hint">
          {delta > 0 ? "Nest under previous field" : "Move out one level"}
        </span>
      )}
    </button>
  );
}
