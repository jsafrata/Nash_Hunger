"use client";

import type { PublicTrade } from "../lib/types";
import { FOOD_DISPLAY_NAMES, FOOD_COLORS } from "../lib/types";

function fmtT(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

export function RecentTrades({ trades }: { trades: PublicTrade[] }) {
  const reversed = [...trades].reverse();
  return (
    <div className="card p-4">
      <div className="section-title mb-3">Recent trades</div>
      {reversed.length === 0 ? (
        <div className="text-xs text-muted italic">no trades yet</div>
      ) : (
        <div className="max-h-72 overflow-y-auto space-y-1.5">
          {reversed.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-2 text-xs"
            >
              <span className="text-muted mono tabular w-10 shrink-0">
                {fmtT(t.elapsedSecond)}
              </span>
              <span className="flex-1 truncate">
                <span className="text-bid font-medium">{t.buyerName}</span>
                <span className="text-muted"> ← </span>
                <span className="mono tabular font-bold">{t.quantity}</span>{" "}
                <span style={{ color: FOOD_COLORS[t.foodType] }}>
                  {FOOD_DISPLAY_NAMES[t.foodType]}
                </span>
                <span className="text-muted"> ← </span>
                <span className="text-ask font-medium">{t.sellerName}</span>
              </span>
              <span className="mono tabular text-accent shrink-0">
                ${t.pricePerUnit}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
