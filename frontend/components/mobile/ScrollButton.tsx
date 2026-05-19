"use client";

import { useRef } from "react";

const PRICE_MIN = 0;
const PRICE_MAX = 20;

/**
 * A "ScrollButton" — a single horizontal box. Tap the LEFT label area to place
 * an order at the current slider price. Drag the RIGHT slider to change the
 * price. The slider has visible bounds ($PRICE_MIN at left, $PRICE_MAX at right).
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
  const trackRef = useRef<HTMLDivElement>(null);

  const updateFromX = (clientX: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const pct = Math.max(
      0,
      Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)),
    );
    const v = Math.round(PRICE_MIN + pct * (PRICE_MAX - PRICE_MIN));
    onPriceChange(v);
  };

  // Slider drag handlers (stop propagation so they don't trigger the order button).
  const onSliderTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    updateFromX(e.touches[0].clientX);
  };
  const onSliderTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    updateFromX(e.touches[0].clientX);
  };
  const onSliderMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateFromX(e.clientX);
    const onMove = (ev: MouseEvent) => updateFromX(ev.clientX);
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const pct = (price - PRICE_MIN) / (PRICE_MAX - PRICE_MIN);
  const actionBg = side === "bid" ? "bg-bid/25" : "bg-ask/25";
  const actionFg = side === "bid" ? "text-bid" : "text-ask";

  return (
    <div
      className={`flex items-stretch rounded-lg border overflow-hidden ${
        disabled ? "opacity-30" : ""
      }`}
      style={{ borderColor: `${color}66`, background: `${color}10` }}
    >
      {/* LEFT: tap target for placing the order */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) onAction();
        }}
        disabled={disabled}
        className={`min-w-[78px] px-2 py-2 ${actionBg} ${actionFg} font-bold text-sm leading-none flex flex-col items-center justify-center gap-0.5 active:brightness-110 disabled:cursor-not-allowed`}
        title={`${label} at $${price}`}
      >
        <span>{label}</span>
        <span className="text-[10px] opacity-80 mono">${price}</span>
      </button>

      {/* RIGHT: bounded slider for setting the price */}
      <div
        className="flex-1 px-2 py-2 flex flex-col justify-center select-none"
        onTouchStart={onSliderTouchStart}
        onTouchMove={onSliderTouchMove}
        onMouseDown={onSliderMouseDown}
        style={{ touchAction: "none" }}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-muted mono w-3 text-right">
            ${PRICE_MIN}
          </span>
          <div
            ref={trackRef}
            className="relative flex-1 h-2 rounded-full bg-line"
          >
            {/* filled portion */}
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${pct * 100}%`,
                background: color,
                opacity: 0.5,
              }}
            />
            {/* thumb */}
            <div
              className="absolute top-1/2 w-4 h-4 rounded-full border-2 border-bg shadow"
              style={{
                background: color,
                left: `${pct * 100}%`,
                transform: "translate(-50%, -50%)",
              }}
            />
          </div>
          <span className="text-[9px] text-muted mono w-5">
            ${PRICE_MAX}
          </span>
        </div>
      </div>
    </div>
  );
}

export const SLIDER_MAX_PRICE = PRICE_MAX;
