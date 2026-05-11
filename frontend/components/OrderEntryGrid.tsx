"use client";

import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import type {
  FoodType,
  PrivatePlayerState,
  PublicOrderBook,
} from "../lib/types";
import {
  FOOD_DISPLAY_NAMES,
  FOOD_TYPES,
  FOOD_COLORS,
  FOOD_HOTKEYS,
  HOTKEY_TO_FOOD,
} from "../lib/types";

interface OrderEntryGridProps {
  socket: Socket | null;
  roomCode: string;
  playerId: string;
  priv: PrivatePlayerState | null;
  orderBooks: Record<FoodType, PublicOrderBook> | null;
  disabled: boolean;
  selectedFood: FoodType;
  setSelectedFood: (f: FoodType) => void;
}

export function OrderEntryGrid({
  socket,
  roomCode,
  playerId,
  priv,
  orderBooks,
  disabled,
  selectedFood,
  setSelectedFood,
}: OrderEntryGridProps) {
  const [postedFlash, setPostedFlash] = useState(0);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bumpFlash = () => {
    setPostedFlash((n) => n + 1);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setPostedFlash(0), 1500);
  };
  useEffect(() => {
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  const marketBuy = (food: FoodType) => {
    if (!socket || disabled || !priv) return;
    const book = orderBooks?.[food];
    const bestAsk = book?.asks[0]?.pricePerUnit;
    if (bestAsk === undefined) return;
    if (priv.availableCash < bestAsk) return;
    socket.emit("post_order", {
      roomCode,
      playerId,
      side: "bid",
      foodType: food,
      quantity: 1,
      pricePerUnit: bestAsk,
    });
    bumpFlash();
  };

  const marketSell = (food: FoodType) => {
    if (!socket || disabled || !priv) return;
    const book = orderBooks?.[food];
    const bestBid = book?.bids[0]?.pricePerUnit;
    if (bestBid === undefined) return;
    if (priv.availableInventory[food] < 1) return;
    socket.emit("post_order", {
      roomCode,
      playerId,
      side: "ask",
      foodType: food,
      quantity: 1,
      pricePerUnit: bestBid,
    });
    bumpFlash();
  };

  // Global hotkeys: u/i/o/p picks food; c cancels all.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (disabled) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const inNumber =
        tag === "INPUT" && (target as HTMLInputElement).type === "number";
      const inText =
        (tag === "INPUT" && !inNumber) ||
        tag === "TEXTAREA" ||
        target?.isContentEditable;
      if (inText) return;
      const key = e.key.toLowerCase();
      if (HOTKEY_TO_FOOD[key]) {
        e.preventDefault();
        setSelectedFood(HOTKEY_TO_FOOD[key]);
      } else if (key === "c") {
        e.preventDefault();
        socket?.emit("cancel_all_orders", { roomCode, playerId });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [disabled, socket, roomCode, playerId, setSelectedFood]);

  return (
    <div className="card p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="section-title flex items-center gap-2">
          <span>Trade</span>
          {postedFlash > 0 && (
            <span className="text-[10px] text-bid normal-case tracking-normal">
              ✓ ×{postedFlash}
            </span>
          )}
        </div>
        <div className="text-[10px] text-muted">
          <span className="text-accent">u/i/o/p</span> select ·{" "}
          <span className="text-accent">c</span> cancel-all
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {FOOD_TYPES.map((f) => (
          <FoodEntry
            key={f}
            food={f}
            socket={socket}
            roomCode={roomCode}
            playerId={playerId}
            priv={priv}
            orderBooks={orderBooks}
            disabled={disabled}
            active={f === selectedFood}
            onActivate={() => setSelectedFood(f)}
            onPostedFlash={bumpFlash}
            onMarketBuy={() => marketBuy(f)}
            onMarketSell={() => marketSell(f)}
          />
        ))}
      </div>
    </div>
  );
}

function FoodEntry({
  food,
  socket,
  roomCode,
  playerId,
  priv,
  orderBooks,
  disabled,
  active,
  onActivate,
  onPostedFlash,
  onMarketBuy,
  onMarketSell,
}: {
  food: FoodType;
  socket: Socket | null;
  roomCode: string;
  playerId: string;
  priv: PrivatePlayerState | null;
  orderBooks: Record<FoodType, PublicOrderBook> | null;
  disabled: boolean;
  active: boolean;
  onActivate: () => void;
  onPostedFlash: () => void;
  onMarketBuy: () => void;
  onMarketSell: () => void;
}) {
  const [qty, setQty] = useState<number>(1);
  const [price, setPrice] = useState<number>(5);

  const book = orderBooks?.[food];
  const bestAsk = book?.asks[0]?.pricePerUnit;
  const bestBid = book?.bids[0]?.pricePerUnit;
  const availCash = priv?.availableCash ?? 0;
  const availFood = priv?.availableInventory[food] ?? 0;

  const canMarketBuy = bestAsk !== undefined && availCash >= bestAsk;
  const canMarketSell = bestBid !== undefined && availFood >= 1;

  const postBid = () => {
    if (!socket || disabled) return;
    if (!Number.isInteger(qty) || qty < 1) return;
    if (!Number.isInteger(price) || price < 0) return;
    if (qty * price > availCash) return;
    socket.emit("post_order", {
      roomCode,
      playerId,
      side: "bid",
      foodType: food,
      quantity: qty,
      pricePerUnit: price,
    });
    onPostedFlash();
  };

  const postAsk = () => {
    if (!socket || disabled) return;
    if (!Number.isInteger(qty) || qty < 1) return;
    if (!Number.isInteger(price) || price < 0) return;
    if (qty > availFood) return;
    socket.emit("post_order", {
      roomCode,
      playerId,
      side: "ask",
      foodType: food,
      quantity: qty,
      pricePerUnit: price,
    });
    onPostedFlash();
  };

  return (
    <div
      className={`rounded-md border p-2 ${
        active ? "border-accent/60 bg-accent/5" : "border-line"
      }`}
      onClick={onActivate}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: FOOD_COLORS[food] }}
        />
        <span
          className="text-xs font-semibold flex-1"
          style={{ color: FOOD_COLORS[food] }}
        >
          {FOOD_DISPLAY_NAMES[food]}
        </span>
        <span className="text-[10px] text-muted mono">
          [{FOOD_HOTKEYS[food]}]
        </span>
      </div>

      {/* Quick market buttons */}
      <div className="grid grid-cols-2 gap-1 mb-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMarketBuy();
          }}
          disabled={disabled || !canMarketBuy}
          className="rounded text-xs font-semibold py-1.5 bg-bid/20 border border-bid/40 text-bid hover:bg-bid/30 disabled:opacity-30 disabled:cursor-not-allowed transition"
          title={
            !canMarketBuy
              ? bestAsk === undefined
                ? "no asks"
                : `need $${bestAsk}, have $${availCash}`
              : `buy 1 @ $${bestAsk}`
          }
        >
          BUY 1
          <div className="text-[9px] opacity-70 font-normal">
            {bestAsk !== undefined ? `@$${bestAsk}` : "—"}
          </div>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMarketSell();
          }}
          disabled={disabled || !canMarketSell}
          className="rounded text-xs font-semibold py-1.5 bg-ask/20 border border-ask/40 text-ask hover:bg-ask/30 disabled:opacity-30 disabled:cursor-not-allowed transition"
          title={
            !canMarketSell
              ? bestBid === undefined
                ? "no bids"
                : `you have ${availFood}`
              : `sell 1 @ $${bestBid}`
          }
        >
          SELL 1
          <div className="text-[9px] opacity-70 font-normal">
            {bestBid !== undefined ? `@$${bestBid}` : "—"}
          </div>
        </button>
      </div>

      {/* Manual entry */}
      <div className="space-y-1">
        <div className="grid grid-cols-2 gap-1">
          <input
            type="number"
            min={1}
            step={1}
            value={qty}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setQty(parseInt(e.target.value || "0", 10))}
            className="w-full text-xs px-1.5 py-1"
            placeholder="qty"
          />
          <input
            type="number"
            min={0}
            step={1}
            value={price}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setPrice(parseInt(e.target.value || "0", 10))}
            className="w-full text-xs px-1.5 py-1"
            placeholder="$"
          />
        </div>
        <div className="grid grid-cols-2 gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              postBid();
            }}
            disabled={disabled || qty * price > availCash}
            className="rounded text-[11px] py-1 border border-line hover:bg-bid/10 hover:border-bid/40 hover:text-bid disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            bid
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              postAsk();
            }}
            disabled={disabled || qty > availFood}
            className="rounded text-[11px] py-1 border border-line hover:bg-ask/10 hover:border-ask/40 hover:text-ask disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            ask
          </button>
        </div>
      </div>
    </div>
  );
}
