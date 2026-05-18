"use client";

import type { PrivatePlayerState } from "../lib/types";
import {
  FOOD_DISPLAY_NAMES,
  FOOD_TYPES,
  FOOD_COLORS,
  FOOD_EMOJIS,
} from "../lib/types";

export function ResourcesPanel({ priv }: { priv: PrivatePlayerState | null }) {
  if (!priv) {
    return (
      <div className="card p-4">
        <div className="section-title mb-3">Your resources</div>
        <div className="text-muted text-sm italic">waiting for game…</div>
      </div>
    );
  }

  return (
    <div className="card p-4 space-y-4">
      <div>
        <div className="section-title mb-2">Cash</div>
        <div className="grid grid-cols-3 gap-2 mono tabular">
          <div>
            <div className="text-2xl font-bold">${priv.cash}</div>
            <div className="text-[10px] text-muted uppercase">Total</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-muted">${priv.reservedCash}</div>
            <div className="text-[10px] text-muted uppercase">Reserved</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-accent">${priv.availableCash}</div>
            <div className="text-[10px] text-muted uppercase">Available</div>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between mb-2">
          <div className="section-title">Inventory</div>
          {priv.produces && (
            <div className="text-xs">
              <span className="text-muted">producing</span>{" "}
              <span
                className="font-bold"
                style={{ color: FOOD_COLORS[priv.produces] }}
              >
                {FOOD_EMOJIS[priv.produces]} {FOOD_DISPLAY_NAMES[priv.produces]}
              </span>
              <span className="text-bid ml-1">+2/cycle</span>
            </div>
          )}
        </div>

        <div className="space-y-1">
          {FOOD_TYPES.map((f) => {
            const isProducer = priv.produces === f;
            return (
              <div
                key={f}
                className={`flex items-center gap-3 px-3 py-2 rounded-md border ${
                  isProducer
                    ? "border-blue-400/60 bg-blue-400/15"
                    : "border-line"
                }`}
              >
                <span className="text-base leading-none">
                  {FOOD_EMOJIS[f]}
                </span>
                <span className="font-medium flex-1">
                  {FOOD_DISPLAY_NAMES[f]}
                </span>
                <span className="mono tabular text-right">
                  {priv.inventory[f]}
                </span>
                {priv.reservedInventory[f] > 0 && (
                  <span className="text-xs text-muted mono tabular">
                    ({priv.reservedInventory[f]} reserved)
                  </span>
                )}
                {isProducer && (
                  <span className="text-[10px] text-blue-300 font-medium uppercase">
                    yours
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
