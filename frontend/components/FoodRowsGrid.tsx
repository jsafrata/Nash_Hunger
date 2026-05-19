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
    <div className="space-y-1.5 relative">
      {postedFlash > 0 && (
        <div className="absolute -top-5 right-1 text-[10px] text-bid pointer-events-none">
          ✓ posted ×{postedFlash}
        </div>
      )}
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
        className="w-6 rounded text-xs leading-none border border-line bg-bg/40 hover:bg-elevated/60 disabled:opacity-30 disabled:cursor-not-allowed transition"
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
        className="w-11 text-xs px-1 py-1 text-center"
      />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onChange(value + 1);
        }}
        disabled={disabled}
        className="w-6 rounded text-xs leading-none border border-line bg-bg/40 hover:bg-elevated/60 disabled:opacity-30 disabled:cursor-not-allowed transition"
        aria-label="increase"
      >
        ▲
      </button>
    </div>
  );
}

// Figgie-style pill button: light pill, dark text, no per-button color.
function PillButton({
  label,
  onClick,
  disabled,
  title,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      title={title}
      className="px-4 py-1.5 rounded-full text-xs font-semibold bg-text text-bg hover:bg-text/90 disabled:opacity-30 disabled:cursor-not-allowed transition"
    >
      {label}
    </button>
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
  const initialPrice = book?.lastTradePrice ?? 5;
  const [bidPrice, setBidPrice] = useState<number>(initialPrice);
  const [askPrice, setAskPrice] = useState<number>(initialPrice);
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

  // Limit orders ("buy" posts a bid; "ask" posts an ask).
  const canPostBid = !disabled && bidPrice <= availCash;
  const canPostOffer = !disabled && availFood >= 1;

  // Market orders (SELL hits best bid; BUY lifts best ask).
  const canMarketSell =
    !disabled && bestBid !== undefined && availFood >= 1;
  const canMarketBuy =
    !disabled && bestAsk !== undefined && bestAsk <= availCash;

  const emit = (
    side: "bid" | "ask",
    price: number,
  ) => {
    if (!socket) return;
    socket.emit("post_order", {
      roomCode,
      playerId,
      side,
      foodType: food,
      quantity: 1,
      pricePerUnit: price,
    });
    onPostedFlash();
  };

  const tint = FOOD_COLORS[food];

  return (
    <div
      className={`rounded-md border transition ${
        active ? "border-accent/70" : ""
      }`}
      style={{
        background: `${tint}1c`,
        borderColor: active ? undefined : `${tint}55`,
      }}
      onClick={onActivate}
    >
      <div className="flex items-center gap-3 px-3 py-2">
        {/* Left action group: big $bid above SELL, then [SELL][buy][stepper] */}
        <div className="flex flex-col items-start gap-1">
          <div
            className="mono tabular font-bold text-2xl text-bid leading-none w-16 text-center"
            title="Best bid · click SELL to take it"
          >
            {bestBid !== undefined ? (
              `$${bestBid}`
            ) : (
              <span className="text-muted/40">—</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <PillButton
              label="ASK"
              onClick={() => bestBid !== undefined && emit("ask", bestBid)}
              disabled={!canMarketSell}
              title={
                bestBid === undefined
                  ? "no bid to sell into"
                  : availFood < 1
                    ? `you have no ${FOOD_DISPLAY_NAMES[food]}`
                    : `sell 1 ${FOOD_DISPLAY_NAMES[food]} at best bid ($${bestBid})`
              }
            />
            <PillButton
              label="BUY"
              onClick={() => emit("bid", bidPrice)}
              disabled={!canPostBid}
              title={`Post a bid for 1 ${FOOD_DISPLAY_NAMES[food]} at $${bidPrice}`}
            />
            <PriceStepper
              value={bidPrice}
              min={0}
              onChange={setBidPrice}
              disabled={disabled}
            />
          </div>
        </div>

        {/* Center: emoji + name + last trade + hotkey */}
        <div className="flex-1 flex items-center justify-center gap-2">
          <span className="text-2xl leading-none">{FOOD_EMOJIS[food]}</span>
          <div className="flex flex-col items-start">
            <span
              className="text-sm font-bold leading-tight"
              style={{ color: tint }}
            >
              {FOOD_DISPLAY_NAMES[food]}
            </span>
            <span className="text-[10px] text-muted mono leading-tight">
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

        {/* Right action group: big $ask above BUY, then [stepper][ask][BUY] */}
        <div className="flex flex-col items-end gap-1">
          <div
            className="mono tabular font-bold text-2xl text-ask leading-none w-16 text-center"
            title="Best ask · click BUY to take it"
          >
            {bestAsk !== undefined ? (
              `$${bestAsk}`
            ) : (
              <span className="text-muted/40">—</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <PriceStepper
              value={askPrice}
              min={0}
              onChange={setAskPrice}
              disabled={disabled}
            />
            <PillButton
              label="ASK"
              onClick={() => emit("ask", askPrice)}
              disabled={!canPostOffer}
              title={`Post an ask for 1 ${FOOD_DISPLAY_NAMES[food]} at $${askPrice}`}
            />
            <PillButton
              label="BUY"
              onClick={() => bestAsk !== undefined && emit("bid", bestAsk)}
              disabled={!canMarketBuy}
              title={
                bestAsk === undefined
                  ? "no ask to lift"
                  : bestAsk > availCash
                    ? `need $${bestAsk}, have $${availCash}`
                    : `buy 1 ${FOOD_DISPLAY_NAMES[food]} at best ask ($${bestAsk})`
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
