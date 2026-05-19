"use client";

import type { PrivatePlayerState } from "../lib/types";
import {
  FOOD_EMOJIS,
  FOOD_TYPES,
  FOOD_COLORS,
  FOOD_DISPLAY_NAMES,
} from "../lib/types";

export function PlayerHandBanner({
  priv,
  name,
}: {
  priv: PrivatePlayerState | null;
  name: string;
}) {
  if (!priv) {
    return (
      <div className="rounded-md bg-accent/15 border border-accent/40 px-4 py-2.5 text-sm text-muted italic">
        waiting for game…
      </div>
    );
  }
  return (
    <div className="rounded-md bg-accent/15 border border-accent/40 px-4 py-2.5 flex items-center gap-6">
      <div className="font-semibold text-accent min-w-[100px] truncate">
        {name}
      </div>

      <div className="flex gap-2 flex-1 justify-center items-center">
        {FOOD_TYPES.map((f) => {
          const total = priv.inventory[f];
          const reserved = priv.reservedInventory[f];
          const isProducer = priv.produces === f;
          const color = FOOD_COLORS[f];
          return (
            <div key={f} className="relative">
              {isProducer && (
                <div
                  className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] font-bold uppercase tracking-wider px-1.5 py-px rounded-full text-bg whitespace-nowrap z-10"
                  style={{ background: color }}
                >
                  you make
                </div>
              )}
              <div
                className={`flex items-center gap-1.5 rounded-md border transition ${
                  isProducer
                    ? "px-3.5 py-1.5 ring-2 shadow-lg"
                    : "px-2.5 py-1"
                }`}
                style={{
                  background: isProducer
                    ? `${color}55`
                    : `${color}1a`,
                  borderColor: isProducer ? color : `${color}40`,
                  ...(isProducer
                    ? ({ "--tw-ring-color": color } as React.CSSProperties)
                    : {}),
                }}
                title={`${FOOD_DISPLAY_NAMES[f]}${
                  isProducer ? " (your production · +2/cycle)" : ""
                }${reserved > 0 ? ` · ${reserved} reserved in asks` : ""}`}
              >
                <span
                  className={`leading-none ${
                    isProducer ? "text-2xl" : "text-lg"
                  }`}
                >
                  {FOOD_EMOJIS[f]}
                </span>
                <span
                  className={`font-bold mono tabular ${
                    isProducer ? "text-xl" : "text-lg"
                  }`}
                  style={{ color }}
                >
                  {total}
                </span>
                {reserved > 0 && (
                  <span className="text-[10px] text-muted mono">
                    −{reserved}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-right min-w-[100px]">
        <div className="mono tabular text-2xl font-bold text-accent">
          ${priv.cash}
        </div>
        {priv.reservedCash > 0 && (
          <div className="text-[10px] text-muted mono">
            ${priv.availableCash} avail
          </div>
        )}
      </div>
    </div>
  );
}
