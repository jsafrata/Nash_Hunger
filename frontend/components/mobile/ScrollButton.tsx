"use client";

import { useRef, useState } from "react";

const PIXELS_PER_STEP = 16;

/**
 * A ScrollButton: tap the LEFT label to place an order at the current price.
 * Swipe vertically on the RIGHT area to change the price — swipe up to
 * increase, swipe down to decrease, one integer step per PIXELS_PER_STEP of
 * finger travel.
 */
export function ScrollButton({
  label,
  price,
  onPriceChange,
  onAction,
  color,
  side,
  disabled,
}: {
  label: string;
  price: number;
  onPriceChange: (p: number) => void;
  onAction: () => void;
  color: string;
  side: "bid" | "ask";
  disabled?: boolean;
}) {
  const startYRef = useRef<number | null>(null);
  const baseRef = useRef<number>(price);
  const [dragging, setDragging] = useState(false);

  const startDrag = (y: number) => {
    startYRef.current = y;
    baseRef.current = price;
    setDragging(true);
  };
  const moveDrag = (y: number) => {
    if (startYRef.current === null) return;
    const dy = startYRef.current - y; // up = positive
    const steps = Math.round(dy / PIXELS_PER_STEP);
    const next = Math.max(0, baseRef.current + steps);
    if (next !== price) onPriceChange(next);
  };
  const endDrag = () => {
    startYRef.current = null;
    setDragging(false);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    startDrag(e.touches[0].clientY);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    moveDrag(e.touches[0].clientY);
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    endDrag();
  };

  // Mouse fallback for desktop testing.
  const onMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    startDrag(e.clientY);
    const onMove = (ev: MouseEvent) => moveDrag(ev.clientY);
    const onUp = () => {
      endDrag();
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const actionBg = side === "bid" ? "bg-bid/25" : "bg-ask/25";
  const actionFg = side === "bid" ? "text-bid" : "text-ask";

  return (
    <div
      className={`flex items-stretch rounded-md border overflow-hidden h-full ${
        disabled ? "opacity-30" : ""
      }`}
      style={{ borderColor: `${color}66`, background: `${color}10` }}
    >
      {/* LEFT: tap-to-order */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) onAction();
        }}
        disabled={disabled}
        className={`flex-1 px-2 ${actionBg} ${actionFg} font-bold text-sm leading-tight flex flex-col items-center justify-center gap-0.5 active:brightness-110 disabled:cursor-not-allowed`}
        title={`${label} at $${price}`}
      >
        <span>{label}</span>
        <span className="text-[10px] opacity-80 mono">${price}</span>
      </button>

      {/* RIGHT: vertical-swipe area for the price */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onMouseDown={onMouseDown}
        style={{
          touchAction: "none",
          userSelect: "none",
          background: dragging ? `${color}44` : `${color}1f`,
          borderColor: `${color}66`,
        }}
        className={`w-12 flex flex-col items-center justify-center select-none border-l transition ${
          dragging ? "scale-105" : ""
        }`}
        aria-label="Swipe vertically to change price"
      >
        <span className="text-[9px] text-muted/70 leading-none">▲</span>
        <span
          className="mono tabular font-bold text-base leading-none my-0.5"
          style={{ color }}
        >
          ${price}
        </span>
        <span className="text-[9px] text-muted/70 leading-none">▼</span>
      </div>
    </div>
  );
}
