"use client";

import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import type { FoodType, OrderSide, PrivatePlayerState } from "../lib/types";
import { FOOD_DISPLAY_NAMES, HOTKEY_TO_FOOD } from "../lib/types";

export function OrderEntry({
  socket,
  roomCode,
  playerId,
  selectedFood,
  setSelectedFood,
  priv,
  disabled,
}: {
  socket: Socket | null;
  roomCode: string;
  playerId: string;
  selectedFood: FoodType;
  setSelectedFood: (f: FoodType) => void;
  priv: PrivatePlayerState | null;
  disabled: boolean;
  pickTrigger?: number;
}) {
  const [side, setSide] = useState<OrderSide>("bid");
  const [quantity, setQuantity] = useState<number>(1);
  const [price, setPrice] = useState<number>(5);
  const [postedFlash, setPostedFlash] = useState(0);

  const qtyRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const sideRef = useRef<OrderSide>(side);
  const quantityRef = useRef(quantity);
  const priceValueRef = useRef(price);
  const disabledRef = useRef(disabled);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    sideRef.current = side;
  }, [side]);
  useEffect(() => {
    quantityRef.current = quantity;
  }, [quantity]);
  useEffect(() => {
    priceValueRef.current = price;
  }, [price]);
  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (disabledRef.current) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const inNumberInput =
        tag === "INPUT" && (target as HTMLInputElement).type === "number";
      const inTextInput =
        (tag === "INPUT" && !inNumberInput) ||
        tag === "TEXTAREA" ||
        target?.isContentEditable;
      // Always allow shortcuts; in text inputs we don't intercept (let user type names etc.)
      if (inTextInput) return;
      const key = e.key.toLowerCase();
      if (key === "b" || key === "s") {
        e.preventDefault();
        const newSide: OrderSide = key === "b" ? "bid" : "ask";
        setSide(newSide);
        sideRef.current = newSide;
        requestAnimationFrame(() => {
          qtyRef.current?.focus();
          qtyRef.current?.select();
        });
      } else if (key === "c") {
        e.preventDefault();
        if (socket) {
          socket.emit("cancel_all_orders", { roomCode, playerId });
        }
      } else if (HOTKEY_TO_FOOD[key]) {
        e.preventDefault();
        setSelectedFood(HOTKEY_TO_FOOD[key]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setSelectedFood, socket, roomCode, playerId]);

  const submit = () => {
    if (!socket) return;
    if (disabledRef.current) return;
    const q = quantityRef.current;
    const p = priceValueRef.current;
    if (!Number.isInteger(q) || q < 1) return;
    if (!Number.isInteger(p) || p < 0) return;
    socket.emit("post_order", {
      roomCode,
      playerId,
      side: sideRef.current,
      foodType: selectedFood,
      quantity: q,
      pricePerUnit: p,
    });
    setPostedFlash((n) => n + 1);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setPostedFlash(0), 1500);
    // keep focus on price input so repeated Enter posts the same order again
    requestAnimationFrame(() => {
      priceRef.current?.focus();
      priceRef.current?.select();
    });
  };

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  const onQtyKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      priceRef.current?.focus();
      priceRef.current?.select();
    }
  };
  const onPriceKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  const cost = quantity * price;
  const availableCash = priv?.availableCash ?? 0;
  const availableForFood = priv?.availableInventory[selectedFood] ?? 0;
  const overCash = side === "bid" && cost > availableCash;
  const overFood = side === "ask" && quantity > availableForFood;
  const blocked = disabled || overCash || overFood;

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="section-title flex items-center gap-2">
          <span>New order</span>
          {postedFlash > 0 && (
            <span className="text-[10px] text-bid normal-case tracking-normal">
              ✓ posted ×{postedFlash}
            </span>
          )}
        </div>
        <div className="text-[11px] text-muted">
          <span className="text-accent">u/i/o/p</span> · {" "}
          <span className="text-accent">b/s</span> · qty · ⏎ · price · ⏎ · {" "}
          <span className="text-accent">c</span> cancel-all
        </div>
      </div>

      <div className="flex gap-2 mb-3">
        <button
          onClick={() => {
            setSide("bid");
            requestAnimationFrame(() => {
              qtyRef.current?.focus();
              qtyRef.current?.select();
            });
          }}
          className={`flex-1 py-2 rounded-md border text-sm font-semibold transition ${
            side === "bid"
              ? "bg-bid/20 border-bid text-bid"
              : "border-line text-muted hover:bg-elevated/40"
          }`}
        >
          BUY <span className="opacity-60 text-[10px]">[B]</span>
        </button>
        <button
          onClick={() => {
            setSide("ask");
            requestAnimationFrame(() => {
              qtyRef.current?.focus();
              qtyRef.current?.select();
            });
          }}
          className={`flex-1 py-2 rounded-md border text-sm font-semibold transition ${
            side === "ask"
              ? "bg-ask/20 border-ask text-ask"
              : "border-line text-muted hover:bg-elevated/40"
          }`}
        >
          SELL <span className="opacity-60 text-[10px]">[S]</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <label className="block text-[11px] text-muted uppercase mb-1">
            Quantity
          </label>
          <input
            ref={qtyRef}
            type="number"
            min={1}
            step={1}
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value || "0", 10))}
            onKeyDown={onQtyKey}
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-[11px] text-muted uppercase mb-1">
            Price/unit
          </label>
          <input
            ref={priceRef}
            type="number"
            min={0}
            step={1}
            value={price}
            onChange={(e) => setPrice(parseInt(e.target.value || "0", 10))}
            onKeyDown={onPriceKey}
            className="w-full"
          />
        </div>
      </div>

      <div className="flex items-baseline justify-between text-xs mb-3">
        <span className="text-muted">
          {side === "bid" ? "Max cost" : "Min revenue"}
        </span>
        <span className="mono tabular text-base font-bold text-accent">
          ${cost}
        </span>
      </div>

      <div className="text-xs text-danger mb-3 min-h-[16px]">
        {overCash &&
          `Need $${cost}, only $${availableCash} available.`}
        {overFood &&
          `Need ${quantity} ${FOOD_DISPLAY_NAMES[selectedFood]}, only ${availableForFood} available.`}
      </div>

      <button
        onClick={submit}
        disabled={blocked}
        className={`w-full py-2.5 rounded-md font-semibold transition ${
          side === "bid"
            ? "bg-bid text-bg hover:bg-bid/90"
            : "bg-ask text-bg hover:bg-ask/90"
        } disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        {side === "bid" ? "Post Bid" : "Post Ask"} —{" "}
        {FOOD_DISPLAY_NAMES[selectedFood]}{" "}
        <span className="opacity-60 text-[11px]">[Enter]</span>
      </button>
    </div>
  );
}
