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
  FOOD_EMOJIS,
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

  // Global hotkeys: g/v/m/k picks food; c cancels all.
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
          <span className="text-accent">g/v/m/k</span> select ·{" "}
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
          />
        ))}
      </div>
    </div>
  );
}

function Stepper({
  value,
  min,
  onChange,
  disabled,
}: {
  value: number;
  min: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-stretch gap-0.5">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onChange(Math.max(min, value - 1));
        }}
        disabled={disabled || value <= min}
        className="w-6 rounded text-sm leading-none border border-line hover:bg-elevated/60 disabled:opacity-30 disabled:cursor-not-allowed transition"
        aria-label="decrease"
      >
        ▼
      </button>
      <input
        type="number"
        min={min}
        step={1}
        value={value}
        disabled={disabled}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onChange(parseInt(e.target.value || String(min), 10))}
        className="flex-1 min-w-0 text-xs px-1 py-1 text-center"
      />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onChange(value + 1);
        }}
        disabled={disabled}
        className="w-6 rounded text-sm leading-none border border-line hover:bg-elevated/60 disabled:opacity-30 disabled:cursor-not-allowed transition"
        aria-label="increase"
      >
        ▲
      </button>
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
}) {
  const [qty, setQty] = useState<number>(1);
  const [price, setPrice] = useState<number>(5);

  const availCash = priv?.availableCash ?? 0;
  const availFood = priv?.availableInventory[food] ?? 0;

  void orderBooks; // reserved for future use

  const postBuy = () => {
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
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-base leading-none">{FOOD_EMOJIS[food]}</span>
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

      <div className="space-y-2">
        <div>
          <label className="block text-[10px] text-muted uppercase tracking-wider mb-1">
            Quantity
          </label>
          <Stepper
            value={qty}
            min={1}
            onChange={setQty}
            disabled={disabled}
          />
        </div>

        <div>
          <label className="block text-[10px] text-muted uppercase tracking-wider mb-1">
            Price per unit
          </label>
          <Stepper
            value={price}
            min={0}
            onChange={setPrice}
            disabled={disabled}
          />
        </div>

        <div className="grid grid-cols-2 gap-1 pt-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              postBuy();
            }}
            disabled={disabled || qty * price > availCash}
            className="rounded text-xs font-semibold py-1.5 bg-bid/20 border border-bid/40 text-bid hover:bg-bid/30 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            buy
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              postAsk();
            }}
            disabled={disabled || qty > availFood}
            className="rounded text-xs font-semibold py-1.5 bg-ask/20 border border-ask/40 text-ask hover:bg-ask/30 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            ask
          </button>
        </div>
      </div>
    </div>
  );
}
