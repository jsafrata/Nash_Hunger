"use client";

import type { FoodType, PublicOrderBook } from "../lib/types";
import {
  FOOD_DISPLAY_NAMES,
  FOOD_TYPES,
  FOOD_COLORS,
  FOOD_HOTKEYS,
} from "../lib/types";

const SIDE_ROWS = 4;
const ROW_HEIGHT_PX = 18;

export function OrderBookView({
  orderBooks,
  selectedFood,
  setSelectedFood,
}: {
  orderBooks: Record<FoodType, PublicOrderBook> | null;
  selectedFood: FoodType;
  setSelectedFood: (f: FoodType) => void;
}) {
  const book = orderBooks?.[selectedFood];
  const bestBid = book?.bids[0]?.pricePerUnit;
  const bestAsk = book?.asks[0]?.pricePerUnit;
  const spread =
    bestBid !== undefined && bestAsk !== undefined ? bestAsk - bestBid : null;
  const mid =
    bestBid !== undefined && bestAsk !== undefined
      ? Math.round((bestBid + bestAsk) / 2)
      : null;

  const maxAskQty = Math.max(1, ...(book?.asks ?? []).map((l) => l.totalQuantity));
  const maxBidQty = Math.max(1, ...(book?.bids ?? []).map((l) => l.totalQuantity));

  const sideHeightPx = SIDE_ROWS * ROW_HEIGHT_PX + (SIDE_ROWS - 1) * 2;

  return (
    <div className="card p-3">
      <div className="flex gap-1 mb-2">
        {FOOD_TYPES.map((f) => {
          const last = orderBooks?.[f]?.lastTradePrice;
          const active = selectedFood === f;
          return (
            <button
              key={f}
              onClick={() => setSelectedFood(f)}
              className={`flex-1 py-1 px-2 rounded-md border text-left transition flex items-center gap-1.5 ${
                active
                  ? "bg-elevated border-line"
                  : "bg-transparent border-transparent hover:bg-elevated/50"
              }`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: FOOD_COLORS[f] }}
              />
              <span
                className="text-xs font-medium truncate"
                style={{ color: active ? FOOD_COLORS[f] : undefined }}
              >
                {FOOD_DISPLAY_NAMES[f]}
              </span>
              <span className="text-[10px] text-muted uppercase mono">
                [{FOOD_HOTKEYS[f]}]
              </span>
              <span className="ml-auto text-[10px] text-muted mono tabular">
                {last !== null && last !== undefined ? `$${last}` : "—"}
              </span>
            </button>
          );
        })}
      </div>

      <div
        className="overflow-y-auto flex flex-col-reverse"
        style={{ height: sideHeightPx }}
      >
        <div className="space-y-0.5">
          {(book?.asks ?? []).slice().reverse().map((lvl, i) => {
            const w = (lvl.totalQuantity / maxAskQty) * 100;
            return (
              <div
                key={`a${i}`}
                className="relative flex items-center text-xs mono tabular"
                style={{ height: ROW_HEIGHT_PX }}
              >
                <div
                  className="absolute inset-y-0 right-0 bg-ask/15 rounded-sm"
                  style={{ width: `${w}%` }}
                />
                <div className="relative flex justify-between w-full px-2">
                  <span className="text-ask">${lvl.pricePerUnit}</span>
                  <span className="text-text">{lvl.totalQuantity}</span>
                </div>
              </div>
            );
          })}
          {!book?.asks?.length && (
            <div className="text-xs text-muted italic px-2 py-1">no asks</div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 my-1.5 px-2 py-1 rounded-md bg-elevated/40 border border-line text-xs">
        <span className="text-muted">Spread</span>
        <span className="mono tabular font-bold text-accent">
          {spread !== null ? `$${spread}` : "—"}
        </span>
        {mid !== null && (
          <>
            <span className="text-muted ml-auto">Mid</span>
            <span className="mono tabular">${mid}</span>
          </>
        )}
      </div>

      <div
        className="overflow-y-auto"
        style={{ height: sideHeightPx }}
      >
        <div className="space-y-0.5">
          {(book?.bids ?? []).map((lvl, i) => {
            const w = (lvl.totalQuantity / maxBidQty) * 100;
            return (
              <div
                key={`b${i}`}
                className="relative flex items-center text-xs mono tabular"
                style={{ height: ROW_HEIGHT_PX }}
              >
                <div
                  className="absolute inset-y-0 left-0 bg-bid/15 rounded-sm"
                  style={{ width: `${w}%` }}
                />
                <div className="relative flex justify-between w-full px-2">
                  <span className="text-bid">${lvl.pricePerUnit}</span>
                  <span className="text-text">{lvl.totalQuantity}</span>
                </div>
              </div>
            );
          })}
          {!book?.bids?.length && (
            <div className="text-xs text-muted italic px-2 py-1">no bids</div>
          )}
        </div>
      </div>
    </div>
  );
}
