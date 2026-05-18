"use client";

import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import type {
  FoodType,
  PrivatePlayerState,
  PublicOrderBook,
} from "../lib/types";
import {
  FOOD_COLORS,
  FOOD_DISPLAY_NAMES,
  FOOD_EMOJIS,
  FOOD_HOTKEYS,
  FOOD_TYPES,
  HOTKEY_TO_FOOD,
} from "../lib/types";

interface FoodRowsGridProps {
  socket: Socket | null;
  roomCode: string;
  playerId: string;
  priv: PrivatePlayerState | null;
  orderBooks: Record<FoodType, PublicOrderBook> | null;
  disabled: boolean;
  selectedFood: FoodType;
  setSelectedFood: (f: FoodType) => void;
}

export function FoodRowsGrid(props: FoodRowsGridProps) {
  const {
    socket,
    roomCode,
    playerId,
    priv,
    orderBooks,
    disabled,
    selectedFood,
    setSelectedFood,
  } = props;

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
    <div className="card p-2">
      <div className="flex items-center justify-between mb-2 px-1">
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

      <div className="space-y-1.5">
        {FOOD_TYPES.map((f) => (
          <FoodRow
            key={f}
            food={f}
            socket={socket}
            roomCode={roomCode}
            playerId={playerId}
            priv={priv}
            book={orderBooks?.[f]}
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

function PriceStepper({
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
        className="w-6 rounded text-xs leading-none border border-line hover:bg-elevated/60 disabled:opacity-30 disabled:cursor-not-allowed transition"
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
        className="w-12 text-xs px-1 py-1 text-center"
      />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onChange(value + 1);
        }}
        disabled={disabled}
        className="w-6 rounded text-xs leading-none border border-line hover:bg-elevated/60 disabled:opacity-30 disabled:cursor-not-allowed transition"
        aria-label="increase"
      >
        ▲
      </button>
    </div>
  );
}

function PriceBadge({
  value,
  side,
}: {
  value: number | null | undefined;
  side: "bid" | "ask";
}) {
  if (value === null || value === undefined) {
    return (
      <span className="inline-flex items-center justify-center w-12 h-7 rounded border border-line/40 text-[11px] text-muted/40 mono">
        —
      </span>
    );
  }
  const cls =
    side === "bid"
      ? "border-bid/40 bg-bid/10 text-bid"
      : "border-ask/40 bg-ask/10 text-ask";
  return (
    <span
      className={`inline-flex items-center justify-center w-12 h-7 rounded border text-xs font-semibold mono tabular ${cls}`}
    >
      ${value}
    </span>
  );
}

function FoodRow({
  food,
  socket,
  roomCode,
  playerId,
  priv,
  book,
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
  book: PublicOrderBook | undefined;
  disabled: boolean;
  active: boolean;
  onActivate: () => void;
  onPostedFlash: () => void;
}) {
  // Default starting price = last trade, else 5
  const initialPrice = book?.lastTradePrice ?? 5;
  const [bidPrice, setBidPrice] = useState<number>(initialPrice);
  const [askPrice, setAskPrice] = useState<number>(initialPrice);

  // If we still have the default value AND a new last-trade comes in, snap to it
  // so steppers reflect a sensible anchor early in the game.
  const priceInitialisedRef = useRef(false);
  useEffect(() => {
    if (priceInitialisedRef.current) return;
    if (book?.lastTradePrice != null) {
      setBidPrice(book.lastTradePrice);
      setAskPrice(book.lastTradePrice);
      priceInitialisedRef.current = true;
    }
  }, [book?.lastTradePrice]);

  const bestBid = book?.bids[0]?.pricePerUnit;
  const bestAsk = book?.asks[0]?.pricePerUnit;
  const lastTrade = book?.lastTradePrice;

  const availCash = priv?.availableCash ?? 0;
  const availFood = priv?.availableInventory[food] ?? 0;
  const myInventory = priv?.inventory[food] ?? 0;

  const canBuy = !disabled && bidPrice <= availCash;
  const canAsk = !disabled && availFood >= 1;

  const postBuy = () => {
    if (!socket || !canBuy) return;
    socket.emit("post_order", {
      roomCode,
      playerId,
      side: "bid",
      foodType: food,
      quantity: 1,
      pricePerUnit: bidPrice,
    });
    onPostedFlash();
  };

  const postAsk = () => {
    if (!socket || !canAsk) return;
    socket.emit("post_order", {
      roomCode,
      playerId,
      side: "ask",
      foodType: food,
      quantity: 1,
      pricePerUnit: askPrice,
    });
    onPostedFlash();
  };

  // Faint tint of the row in the food's color
  const tint = FOOD_COLORS[food];

  return (
    <div
      className={`rounded-md border ${
        active ? "border-accent/60" : "border-line"
      }`}
      style={{ background: `${tint}10` }}
      onClick={onActivate}
    >
      <div className="flex items-center gap-2 px-2 py-1.5">
        {/* Far left: your inventory of this food */}
        <div
          className="flex items-center gap-1 px-2 py-1 rounded-md border border-line bg-bg/40 mono tabular text-xs min-w-[44px] justify-center"
          title={`You hold ${myInventory} ${FOOD_DISPLAY_NAMES[food]}`}
        >
          <span className="text-muted">you</span>
          <span className="font-semibold">{myInventory}</span>
        </div>

        {/* Bid side: best bid badge + my bid stepper + BUY button */}
        <PriceBadge value={bestBid} side="bid" />
        <PriceStepper
          value={bidPrice}
          min={0}
          onChange={setBidPrice}
          disabled={disabled}
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            postBuy();
          }}
          disabled={!canBuy}
          className="px-3 py-1.5 rounded text-xs font-semibold bg-bid/20 border border-bid/40 text-bid hover:bg-bid/30 disabled:opacity-30 disabled:cursor-not-allowed transition"
          title={`Post a bid for 1 ${FOOD_DISPLAY_NAMES[food]} at $${bidPrice}`}
        >
          buy
        </button>

        {/* Center: food emoji + name + last trade */}
        <div className="flex-1 flex items-center justify-center gap-2">
          <span className="text-xl leading-none">{FOOD_EMOJIS[food]}</span>
          <div className="flex flex-col items-start">
            <span
              className="text-sm font-semibold"
              style={{ color: tint }}
            >
              {FOOD_DISPLAY_NAMES[food]}
            </span>
            <span className="text-[10px] text-muted mono">
              last{" "}
              <span className="text-accent">
                {lastTrade !== null && lastTrade !== undefined
                  ? `$${lastTrade}`
                  : "—"}
              </span>
            </span>
          </div>
          <span className="text-[10px] text-muted mono">
            [{FOOD_HOTKEYS[food]}]
          </span>
        </div>

        {/* Ask side: ASK button + my ask stepper + best ask badge */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            postAsk();
          }}
          disabled={!canAsk}
          className="px-3 py-1.5 rounded text-xs font-semibold bg-ask/20 border border-ask/40 text-ask hover:bg-ask/30 disabled:opacity-30 disabled:cursor-not-allowed transition"
          title={`Post an ask for 1 ${FOOD_DISPLAY_NAMES[food]} at $${askPrice}`}
        >
          ask
        </button>
        <PriceStepper
          value={askPrice}
          min={0}
          onChange={setAskPrice}
          disabled={disabled}
        />
        <PriceBadge value={bestAsk} side="ask" />

        {/* Far right: your inventory again (mirror, for symmetry like figgie) */}
        <div
          className="flex items-center gap-1 px-2 py-1 rounded-md border border-line bg-bg/40 mono tabular text-xs min-w-[44px] justify-center"
          title={`You hold ${myInventory} ${FOOD_DISPLAY_NAMES[food]}`}
        >
          <span className="font-semibold">{myInventory}</span>
          <span className="text-muted">you</span>
        </div>
      </div>
    </div>
  );
}
