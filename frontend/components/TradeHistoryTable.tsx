"use client";

import type { PublicTrade } from "../lib/types";
import { FOOD_EMOJIS } from "../lib/types";

export function TradeHistoryTable({
  trades,
  selfId,
}: {
  trades: PublicTrade[];
  selfId: string | null;
}) {
  const reversed = [...trades].reverse();
  return (
    <div className="card p-3">
      <div className="section-title mb-2">Trade history</div>
      {reversed.length === 0 ? (
        <div className="text-xs text-muted italic">no trades yet</div>
      ) : (
        <div className="max-h-[420px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] text-muted uppercase tracking-wider">
                <th className="text-left font-normal pb-1 pr-2">Buyer</th>
                <th className="text-center font-normal pb-1">Food</th>
                <th className="text-right font-normal pb-1 pl-2">Seller</th>
                <th className="text-right font-normal pb-1 pl-2">Price</th>
              </tr>
            </thead>
            <tbody>
              {reversed.map((t) => {
                const buyerIsSelf = t.buyerId === selfId;
                const sellerIsSelf = t.sellerId === selfId;
                return (
                  <tr key={t.id} className="border-t border-line/30">
                    <td
                      className={`py-1 pr-2 truncate max-w-[100px] ${
                        buyerIsSelf
                          ? "text-accent font-semibold"
                          : "text-bid"
                      }`}
                    >
                      {t.buyerName}
                      {t.quantity > 1 && (
                        <span className="text-muted ml-1">×{t.quantity}</span>
                      )}
                    </td>
                    <td className="py-1 text-center">
                      {FOOD_EMOJIS[t.foodType]}
                    </td>
                    <td
                      className={`py-1 text-right pl-2 truncate max-w-[100px] ${
                        sellerIsSelf
                          ? "text-accent font-semibold"
                          : "text-ask"
                      }`}
                    >
                      {t.sellerName}
                    </td>
                    <td className="py-1 text-right pl-2 mono tabular text-accent">
                      ${t.pricePerUnit}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
