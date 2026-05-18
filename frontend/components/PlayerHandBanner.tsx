"use client";

import type { PrivatePlayerState } from "../lib/types";
import { FOOD_EMOJIS, FOOD_TYPES, FOOD_COLORS, FOOD_DISPLAY_NAMES } from "../lib/types";

export function PlayerHandBanner({
  priv,
  name,
}: {
  priv: PrivatePlayerState | null;
  name: string;
}) {
  if (!priv) {
    return (
      <div className="card p-3 text-muted text-sm italic">
        waiting for game…
      </div>
    );
  }
  return (
    <div className="card p-3 flex items-center gap-6">
      <div className="flex items-baseline gap-2 min-w-[120px]">
        <span className="font-semibold">{name}</span>
        <span className="text-[10px] text-accent">YOU</span>
      </div>

      <div className="flex gap-3 flex-1 justify-center">
        {FOOD_TYPES.map((f) => {
          const isProducer = priv.produces === f;
          const total = priv.inventory[f];
          const reserved = priv.reservedInventory[f];
          return (
            <div
              key={f}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${
                isProducer
                  ? "bg-blue-400/15 border border-blue-400/40"
                  : "border border-line"
              }`}
              title={`${FOOD_DISPLAY_NAMES[f]}${
                isProducer ? " (your production)" : ""
              }`}
            >
              <span className="text-base leading-none">{FOOD_EMOJIS[f]}</span>
              <span
                className="font-bold mono tabular text-lg"
                style={isProducer ? { color: FOOD_COLORS[f] } : undefined}
              >
                {total}
              </span>
              {reserved > 0 && (
                <span className="text-[10px] text-muted mono">
                  −{reserved}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="text-right min-w-[120px]">
        <div className="mono tabular text-2xl font-bold text-accent">
          ${priv.cash}
        </div>
        {priv.reservedCash > 0 && (
          <div className="text-[10px] text-muted mono">
            ${priv.availableCash} avail · ${priv.reservedCash} reserved
          </div>
        )}
      </div>
    </div>
  );
}
