"use client";

import type { PrivatePlayerState } from "../lib/types";
import { FOOD_DISPLAY_NAMES, FOOD_TYPES, FOOD_COLORS } from "../lib/types";

export function ResourcesPanel({ priv }: { priv: PrivatePlayerState | null }) {
  if (!priv) {
    return (
      <div className="card p-4">
        <div className="section-title mb-3">Your resources</div>
        <div className="text-muted text-sm italic">waiting for game…</div>
      </div>
    );
  }

  const minSurvival = Math.min(
    ...priv.requiredFoods.map((f) => priv.secondsUntilStarvation[f] ?? 0),
    Infinity,
  );

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
                {FOOD_DISPLAY_NAMES[priv.produces]}
              </span>
              <span className="text-bid ml-1">+2/s</span>
            </div>
          )}
        </div>

        <div className="space-y-1">
          {FOOD_TYPES.map((f) => {
            const isProducer = priv.produces === f;
            const survival = priv.secondsUntilStarvation[f];
            const danger =
              !isProducer && typeof survival === "number" && survival <= 5;
            const warn =
              !isProducer && typeof survival === "number" && survival <= 10;
            return (
              <div
                key={f}
                className={`flex items-center gap-3 px-3 py-2 rounded-md border ${
                  danger
                    ? "border-danger/50 bg-danger/10"
                    : warn
                      ? "border-warn/30 bg-warn/5"
                      : isProducer
                        ? "border-blue-400/60 bg-blue-400/15"
                        : "border-line"
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: FOOD_COLORS[f] }}
                />
                <span className="font-medium w-14 shrink-0">
                  {FOOD_DISPLAY_NAMES[f]}
                </span>
                <span className="mono tabular text-right w-10">
                  {priv.inventory[f]}
                </span>
                {priv.reservedInventory[f] > 0 && (
                  <span className="text-xs text-muted mono tabular">
                    ({priv.reservedInventory[f]} reserved)
                  </span>
                )}
                <span className="ml-auto text-xs">
                  {isProducer ? (
                    <span className="text-blue-300 font-medium">producer</span>
                  ) : (
                    <span
                      className={`mono tabular font-bold ${
                        danger ? "text-danger" : warn ? "text-warn" : "text-muted"
                      }`}
                    >
                      {survival ?? 0}s
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>

        {minSurvival !== Infinity && minSurvival <= 5 && (
          <div className="mt-2 px-3 py-2 rounded-md bg-danger/15 border border-danger/40 text-danger text-xs font-bold">
            ⚠ Starving in {minSurvival}s — buy food now
          </div>
        )}
      </div>
    </div>
  );
}
