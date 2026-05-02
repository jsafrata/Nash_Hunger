"use client";

import type { Socket } from "socket.io-client";
import type { OwnOrderView } from "../lib/types";
import { FOOD_DISPLAY_NAMES, FOOD_COLORS } from "../lib/types";

export function OwnOrders({
  socket,
  roomCode,
  playerId,
  orders,
  disabled,
}: {
  socket: Socket | null;
  roomCode: string;
  playerId: string;
  orders: OwnOrderView[];
  disabled: boolean;
}) {
  const cancel = (orderId: string) => {
    socket?.emit("cancel_order", { roomCode, playerId, orderId });
  };
  const cancelAll = () => {
    socket?.emit("cancel_all_orders", { roomCode, playerId });
  };

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="section-title">Your open orders</div>
        <button
          onClick={cancelAll}
          disabled={disabled || orders.length === 0}
          className="btn-ghost"
        >
          Cancel all
        </button>
      </div>
      {orders.length === 0 ? (
        <div className="text-xs text-muted italic py-1">no open orders</div>
      ) : (
        <div className="space-y-1">
          {orders.map((o) => (
            <div
              key={o.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-line"
            >
              <span
                className={`text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded ${
                  o.side === "bid"
                    ? "bg-bid/15 text-bid"
                    : "bg-ask/15 text-ask"
                }`}
              >
                {o.side === "bid" ? "BID" : "ASK"}
              </span>
              <span
                className="text-sm font-medium"
                style={{ color: FOOD_COLORS[o.foodType] }}
              >
                {FOOD_DISPLAY_NAMES[o.foodType]}
              </span>
              <span className="ml-auto text-sm mono tabular">
                {o.remainingQuantity}
                {o.remainingQuantity !== o.originalQuantity && (
                  <span className="text-muted">/{o.originalQuantity}</span>
                )}{" "}
                <span className="text-muted">@</span>{" "}
                <span className="text-accent">${o.pricePerUnit}</span>
              </span>
              <button
                onClick={() => cancel(o.id)}
                disabled={disabled}
                className="btn-ghost text-[11px]"
              >
                cancel
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
