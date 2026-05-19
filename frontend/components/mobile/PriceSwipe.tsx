"use client";

import { useRef, useState } from "react";

const PIXELS_PER_STEP = 24;

/**
 * Vertical-swipe price control. Swipe up = price increases, swipe down =
 * decreases, one integer step per PIXELS_PER_STEP of finger travel.
 *
 * Touch-action: none on the swipe surface so the gesture doesn't trigger the
 * browser's page scroll.
 */
export function PriceSwipe({
  value,
  min,
  onChange,
  color,
}: {
  value: number;
  min: number;
  onChange: (v: number) => void;
  color: string;
}) {
  const startYRef = useRef<number | null>(null);
  const baseRef = useRef<number>(value);
  const [dragging, setDragging] = useState(false);

  const onTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
    baseRef.current = value;
    setDragging(true);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startYRef.current === null) return;
    const dy = startYRef.current - e.touches[0].clientY; // up = positive
    const steps = Math.round(dy / PIXELS_PER_STEP);
    const next = Math.max(min, baseRef.current + steps);
    if (next !== value) onChange(next);
  };
  const onTouchEnd = () => {
    startYRef.current = null;
    setDragging(false);
  };

  // Mouse fallback so testing on desktop works too.
  const onMouseDown = (e: React.MouseEvent) => {
    startYRef.current = e.clientY;
    baseRef.current = value;
    setDragging(true);
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (startYRef.current === null) return;
    const dy = startYRef.current - e.clientY;
    const steps = Math.round(dy / PIXELS_PER_STEP);
    const next = Math.max(min, baseRef.current + steps);
    if (next !== value) onChange(next);
  };
  const onMouseEnd = () => {
    startYRef.current = null;
    setDragging(false);
  };

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseEnd}
      onMouseLeave={onMouseEnd}
      style={{
        touchAction: "none",
        userSelect: "none",
        background: dragging ? `${color}44` : `${color}22`,
        borderColor: color,
      }}
      className={`relative flex flex-col items-center justify-center rounded-xl border-2 select-none transition-colors py-3 ${
        dragging ? "scale-[1.02]" : ""
      }`}
    >
      <div className="text-[10px] text-muted leading-none">price</div>
      <div
        className="mono tabular font-bold leading-none"
        style={{ color, fontSize: 44 }}
      >
        ${value}
      </div>
      <div className="text-[10px] text-muted leading-none mt-1">
        ↕ swipe to change
      </div>
      {/* faint up/down arrow hints */}
      <div
        className="absolute right-2 top-2 text-[12px] text-muted/40 leading-none pointer-events-none select-none"
        aria-hidden
      >
        ▲
      </div>
      <div
        className="absolute right-2 bottom-2 text-[12px] text-muted/40 leading-none pointer-events-none select-none"
        aria-hidden
      >
        ▼
      </div>
    </div>
  );
}
