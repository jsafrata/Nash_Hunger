"use client";

import type { FoodType, PublicOrderBook } from "../lib/types";
import { FOOD_DISPLAY_NAMES, FOOD_TYPES, FOOD_COLORS } from "../lib/types";

const ROWS_PER_SIDE = 4;

export function OrderBookGrid({
  orderBooks,
  selectedFood,
  setSelectedFood,
}: {
  orderBooks: Record<FoodType, PublicOrderBook> | null;
  selectedFood: FoodType;
  setSelectedFood: (f: FoodType) => void;
}) {
  return (
    <div className="card p-3">
      <div className="grid grid-cols-4 gap-2">
        {FOOD_TYPES.map((f) => (
          <FoodBook
            key={f}
            food={f}
            book={orderBooks?.[f]}
            active={f === selectedFood}
            onClick={() => setSelectedFood(f)}
          />
        ))}
      </div>
    </div>
  );
}

function FoodBook({
  food,
  book,
  active,
  onClick,
}: {
  food: FoodType;
  book: PublicOrderBook | undefined;
  active: boolean;
  onClick: () => void;
}) {
  const bestBid = book?.bids[0]?.pricePerUnit;
  const bestAsk = book?.asks[0]?.pricePerUnit;
  const spread =
    bestBid !== undefined && bestAsk !== undefined ? bestAsk - bestBid : null;

  // Pad lists to fixed rows so all 4 columns line up vertically.
  const asks = (book?.asks ?? []).slice(0, ROWS_PER_SIDE);
  while (asks.length < ROWS_PER_SIDE)
    asks.push({ pricePerUnit: -1, totalQuantity: 0 });
  const bids = (book?.bids ?? []).slice(0, ROWS_PER_SIDE);
  while (bids.length < ROWS_PER_SIDE)
    bids.push({ pricePerUnit: -1, totalQuantity: 0 });

  return (
    <button
      onClick={onClick}
      className={`text-left rounded-md border p-2 transition ${
        active ? "border-accent/60 bg-accent/5" : "border-line"
      }`}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: FOOD_COLORS[food] }}
        />
        <span
          className="text-xs font-semibold"
          style={{ color: FOOD_COLORS[food] }}
        >
          {FOOD_DISPLAY_NAMES[food]}
        </span>
      </div>

      <div className="grid grid-cols-2 text-[10px] text-muted mb-0.5">
        <span>Price</span>
        <span className="text-right">Qty</span>
      </div>

      {/* asks: low → high, reversed so the spread is in the middle */}
      <div className="space-y-0.5 mb-1">
        {asks
          .slice()
          .reverse()
          .map((l, i) => (
            <div
              key={`a${i}`}
              className="grid grid-cols-2 text-xs mono tabular"
            >
              {l.pricePerUnit < 0 ? (
                <>
                  <span className="text-muted/40">·</span>
                  <span></span>
                </>
              ) : (
                <>
                  <span className="text-ask">${l.pricePerUnit}</span>
                  <span className="text-right">{l.totalQuantity}</span>
                </>
              )}
            </div>
          ))}
      </div>

      <div className="flex items-center justify-between border-y border-line/40 py-0.5 mb-1 text-[10px]">
        <span className="text-muted">spread</span>
        <span className="mono tabular text-accent font-semibold">
          {spread !== null ? `$${spread}` : "—"}
        </span>
      </div>

      <div className="space-y-0.5">
        {bids.map((l, i) => (
          <div
            key={`b${i}`}
            className="grid grid-cols-2 text-xs mono tabular"
          >
            {l.pricePerUnit < 0 ? (
              <>
                <span className="text-muted/40">·</span>
                <span></span>
              </>
            ) : (
              <>
                <span className="text-bid">${l.pricePerUnit}</span>
                <span className="text-right">{l.totalQuantity}</span>
              </>
            )}
          </div>
        ))}
      </div>

      {book?.lastTradePrice !== null && book?.lastTradePrice !== undefined && (
        <div className="text-[10px] text-muted mt-1.5 text-center">
          last ${book.lastTradePrice} ×{book.lastTradeQuantity}
        </div>
      )}
    </button>
  );
}
