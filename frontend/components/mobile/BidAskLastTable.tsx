"use client";

import type { FoodType, PublicOrderBook } from "../../lib/types";
import { FOOD_COLORS, FOOD_EMOJIS, FOOD_TYPES } from "../../lib/types";

export function BidAskLastTable({
  orderBooks,
}: {
  orderBooks: Record<FoodType, PublicOrderBook> | null;
}) {
  return (
    <div className="card px-2 py-1.5">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[10px] text-muted uppercase tracking-wider">
            <th className="text-left font-normal pb-1 w-8">food</th>
            <th className="text-right font-normal pb-1">bid</th>
            <th className="text-right font-normal pb-1">ask</th>
            <th className="text-right font-normal pb-1">last</th>
          </tr>
        </thead>
        <tbody>
          {FOOD_TYPES.map((f) => {
            const b = orderBooks?.[f];
            const bestBid = b?.bids[0]?.pricePerUnit;
            const bestAsk = b?.asks[0]?.pricePerUnit;
            const last = b?.lastTradePrice;
            return (
              <tr
                key={f}
                className="border-t border-line/30"
                style={{ background: `${FOOD_COLORS[f]}10` }}
              >
                <td className="py-1">
                  <span className="text-base leading-none">
                    {FOOD_EMOJIS[f]}
                  </span>
                </td>
                <td className="py-1 text-right mono tabular text-bid">
                  {bestBid != null ? `$${bestBid}` : <span className="text-muted/40">—</span>}
                </td>
                <td className="py-1 text-right mono tabular text-ask">
                  {bestAsk != null ? `$${bestAsk}` : <span className="text-muted/40">—</span>}
                </td>
                <td className="py-1 text-right mono tabular text-accent">
                  {last != null ? `$${last}` : <span className="text-muted/40">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
