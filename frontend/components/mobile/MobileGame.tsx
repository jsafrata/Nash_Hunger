"use client";

import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import type {
  FoodType,
  PrivatePlayerState,
  PublicGameState,
  PublicOrderBook,
  PublicPlayerState,
} from "../../lib/types";
import {
  FOOD_COLORS,
  FOOD_DISPLAY_NAMES,
  FOOD_EMOJIS,
  FOOD_TYPES,
} from "../../lib/types";
import { PriceSwipe } from "./PriceSwipe";

interface MobileGameProps {
  socket: Socket | null;
  roomCode: string;
  playerId: string | null;
  publicState: PublicGameState | null;
  privateState: PrivatePlayerState | null;
  orderBooks: Record<FoodType, PublicOrderBook> | null;
  disabled: boolean;
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function MobileGame({
  socket,
  roomCode,
  playerId,
  publicState,
  privateState,
  orderBooks,
  disabled,
}: MobileGameProps) {
  const remaining = publicState?.remainingSeconds ?? 0;
  const aliveCount =
    publicState?.players.filter((p) => p.status === "alive").length ?? 0;
  const totalSeats = publicState?.players.length ?? 0;
  const selfName =
    publicState?.players.find((p) => p.id === playerId)?.name ?? "You";

  // Per-food price state — independent for each row.
  const [prices, setPrices] = useState<Record<FoodType, number>>({
    A: 5,
    B: 5,
    C: 5,
    D: 5,
  });
  // Initialize per-food price to last trade price the first time we see one.
  const priceInitRef = useRef<Record<FoodType, boolean>>({
    A: false,
    B: false,
    C: false,
    D: false,
  });
  useEffect(() => {
    if (!orderBooks) return;
    for (const f of FOOD_TYPES) {
      if (priceInitRef.current[f]) continue;
      const last = orderBooks[f]?.lastTradePrice;
      if (last != null) {
        setPrices((p) => ({ ...p, [f]: last }));
        priceInitRef.current[f] = true;
      }
    }
  }, [orderBooks]);

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

  const placeOrder = (food: FoodType, side: "bid" | "ask") => {
    if (!socket || disabled) return;
    const price = prices[food];
    socket.emit("post_order", {
      roomCode,
      playerId,
      side,
      foodType: food,
      quantity: 1,
      pricePerUnit: price,
    });
    bumpFlash();
  };

  const players = publicState?.players ?? [];

  return (
    <div className="min-h-screen flex flex-col gap-2 p-2">
      {/* Top header — compact: time, cash */}
      <div className="card px-3 py-2 flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] text-muted uppercase tracking-wider">
            time
          </span>
          <span
            className={`mono tabular font-bold text-2xl ${
              remaining <= 30
                ? "text-danger"
                : remaining <= 60
                  ? "text-warn"
                  : "text-text"
            }`}
          >
            {fmtTime(remaining)}
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] text-muted uppercase tracking-wider">
            cash
          </span>
          <span className="mono tabular font-bold text-2xl text-accent">
            ${privateState?.cash ?? 0}
          </span>
        </div>
      </div>

      {/* Your inventory strip */}
      <div className="card px-2 py-1.5">
        <div className="flex justify-around items-center">
          {FOOD_TYPES.map((f) => {
            const isProducer = privateState?.produces === f;
            const count = privateState?.inventory[f] ?? 0;
            const color = FOOD_COLORS[f];
            return (
              <div
                key={f}
                className={`flex items-center gap-1 px-2 py-1 rounded-md ${
                  isProducer ? "border-2" : ""
                }`}
                style={{
                  background: isProducer ? `${color}55` : "transparent",
                  borderColor: isProducer ? color : "transparent",
                }}
              >
                <span className="text-base leading-none">{FOOD_EMOJIS[f]}</span>
                <span
                  className="mono tabular font-bold text-lg"
                  style={{ color }}
                >
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Players strip */}
      <PlayersStrip players={players} selfId={playerId} selfName={selfName} aliveCount={aliveCount} totalSeats={totalSeats} />

      {/* 4 food cards stacked, each: name | swipe-price | [BUY][SELL] */}
      <div className="flex flex-col gap-2 relative">
        {postedFlash > 0 && (
          <div className="absolute -top-1 right-2 text-[10px] text-bid pointer-events-none">
            ✓ ×{postedFlash}
          </div>
        )}
        {FOOD_TYPES.map((f) => (
          <FoodCard
            key={f}
            food={f}
            price={prices[f]}
            setPrice={(p) => setPrices((cur) => ({ ...cur, [f]: p }))}
            book={orderBooks?.[f]}
            priv={privateState}
            disabled={disabled}
            onBuy={() => placeOrder(f, "bid")}
            onSell={() => placeOrder(f, "ask")}
          />
        ))}
      </div>
    </div>
  );
}

function PlayersStrip({
  players,
  selfId,
  selfName,
  aliveCount,
  totalSeats,
}: {
  players: PublicPlayerState[];
  selfId: string | null;
  selfName: string;
  aliveCount: number;
  totalSeats: number;
}) {
  return (
    <div className="card px-2 py-1.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-muted uppercase tracking-wider">
          players
        </span>
        <span className="text-[10px] text-muted mono">
          {aliveCount}/{totalSeats} alive
        </span>
      </div>
      <div className="grid grid-cols-4 gap-1">
        {players.map((p) => {
          const isSelf = p.id === selfId;
          const color = p.produces ? FOOD_COLORS[p.produces] : "#7c8390";
          const dead = p.status === "dead";
          return (
            <div
              key={p.id}
              className={`rounded-md border px-1.5 py-1 text-center ${
                dead ? "opacity-40" : ""
              } ${isSelf ? "ring-1 ring-accent" : ""}`}
              style={{
                background: `${color}1f`,
                borderColor: `${color}66`,
              }}
            >
              <div
                className="text-[10px] font-semibold truncate"
                style={{ color }}
              >
                {isSelf ? selfName : p.name}
              </div>
              <div className="text-[9px] text-muted mt-0.5">
                {p.status === "alive" ? "● alive" : "† dead"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FoodCard({
  food,
  price,
  setPrice,
  book,
  priv,
  disabled,
  onBuy,
  onSell,
}: {
  food: FoodType;
  price: number;
  setPrice: (p: number) => void;
  book: PublicOrderBook | undefined;
  priv: PrivatePlayerState | null;
  disabled: boolean;
  onBuy: () => void;
  onSell: () => void;
}) {
  const color = FOOD_COLORS[food];
  const bestBid = book?.bids[0]?.pricePerUnit;
  const bestAsk = book?.asks[0]?.pricePerUnit;
  const lastTrade = book?.lastTradePrice;

  const availCash = priv?.availableCash ?? 0;
  const availFood = priv?.availableInventory[food] ?? 0;
  const myInv = priv?.inventory[food] ?? 0;

  const canBuy = !disabled && price <= availCash;
  const canSell = !disabled && availFood >= 1;

  return (
    <div
      className="rounded-xl border-2 p-2"
      style={{ background: `${color}14`, borderColor: `${color}55` }}
    >
      {/* Header: emoji + name + your inv + market quotes */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl leading-none">{FOOD_EMOJIS[food]}</span>
          <span className="font-bold" style={{ color }}>
            {FOOD_DISPLAY_NAMES[food]}
          </span>
        </div>
        <div className="text-[10px] text-muted mono tabular leading-tight text-right">
          <div>
            you <span className="text-text font-bold">{myInv}</span>
          </div>
          <div>
            last{" "}
            <span className="text-accent">
              {lastTrade != null ? `$${lastTrade}` : "—"}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-2 items-stretch">
        {/* Left: swipe-to-change price */}
        <PriceSwipe value={price} min={0} onChange={setPrice} color={color} />

        {/* Right: BUY and SELL stacked */}
        <div className="flex flex-col gap-1.5 justify-stretch min-w-[100px]">
          <button
            type="button"
            onClick={onBuy}
            disabled={!canBuy}
            className="flex-1 rounded-lg font-bold text-base bg-bid text-bg active:bg-bid/80 disabled:opacity-30 disabled:cursor-not-allowed transition py-3"
          >
            BUY
            <div className="text-[10px] font-normal opacity-80">@ ${price}</div>
          </button>
          <button
            type="button"
            onClick={onSell}
            disabled={!canSell}
            className="flex-1 rounded-lg font-bold text-base bg-ask text-bg active:bg-ask/80 disabled:opacity-30 disabled:cursor-not-allowed transition py-3"
          >
            SELL
            <div className="text-[10px] font-normal opacity-80">@ ${price}</div>
          </button>
        </div>
      </div>

      {/* Market reference line at the bottom */}
      <div className="flex items-center justify-between mt-1.5 text-[10px] mono tabular px-1">
        <span className="text-bid">
          best bid {bestBid != null ? `$${bestBid}` : "—"}
        </span>
        <span className="text-ask">
          best ask {bestAsk != null ? `$${bestAsk}` : "—"}
        </span>
      </div>
    </div>
  );
}
