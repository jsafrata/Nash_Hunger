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
  FOOD_EMOJIS,
  FOOD_TYPES,
} from "../../lib/types";
import { BidAskLastTable } from "./BidAskLastTable";
import { ScrollButton } from "./ScrollButton";

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

  // Per-food, per-side prices (so bid price for Grain and ask price for Grain
  // can differ). Initialized to a sane default.
  const [bidPrices, setBidPrices] = useState<Record<FoodType, number>>({
    A: 5,
    B: 5,
    C: 5,
    D: 5,
  });
  const [askPrices, setAskPrices] = useState<Record<FoodType, number>>({
    A: 5,
    B: 5,
    C: 5,
    D: 5,
  });

  // Snap each price to the last-trade price the first time we see one.
  const initRef = useRef<Record<FoodType, boolean>>({
    A: false,
    B: false,
    C: false,
    D: false,
  });
  useEffect(() => {
    if (!orderBooks) return;
    for (const f of FOOD_TYPES) {
      if (initRef.current[f]) continue;
      const last = orderBooks[f]?.lastTradePrice;
      if (last != null) {
        setBidPrices((p) => ({ ...p, [f]: last }));
        setAskPrices((p) => ({ ...p, [f]: last }));
        initRef.current[f] = true;
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
    const price = side === "bid" ? bidPrices[food] : askPrices[food];
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
  const priv = privateState;

  return (
    <div className="h-screen flex flex-col gap-1.5 p-1.5 overflow-hidden">
      {/* 1. Time + cash */}
      <div className="card px-3 py-1.5 flex items-center justify-between shrink-0">
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] text-muted uppercase tracking-wider">
            time
          </span>
          <span
            className={`mono tabular font-bold text-xl ${
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
          <span className="mono tabular font-bold text-xl text-accent">
            ${priv?.cash ?? 0}
          </span>
        </div>
      </div>

      {/* 2. Your inventory strip */}
      <div className="card px-2 py-1 shrink-0">
        <div className="flex justify-around items-center">
          {FOOD_TYPES.map((f) => {
            const isProducer = priv?.produces === f;
            const count = priv?.inventory[f] ?? 0;
            const color = FOOD_COLORS[f];
            return (
              <div
                key={f}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-md ${
                  isProducer ? "border-2" : ""
                }`}
                style={{
                  background: isProducer ? `${color}55` : "transparent",
                  borderColor: isProducer ? color : "transparent",
                }}
              >
                <span className="text-base leading-none">
                  {FOOD_EMOJIS[f]}
                </span>
                <span
                  className="mono tabular font-bold text-base"
                  style={{ color }}
                >
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Players */}
      <PlayersStrip
        players={players}
        selfId={playerId}
        selfName={selfName}
        aliveCount={aliveCount}
        totalSeats={totalSeats}
      />

      {/* 4. Bid/Ask/Last table */}
      <BidAskLastTable orderBooks={orderBooks} />

      {/* 5. 4×2 grid of ScrollButtons (buy on left, ask on right per row) */}
      <div className="relative flex-1 flex flex-col gap-1.5 min-h-0">
        {postedFlash > 0 && (
          <div className="absolute -top-1 right-1 text-[10px] text-bid pointer-events-none z-10">
            ✓ ×{postedFlash}
          </div>
        )}
        {FOOD_TYPES.map((f) => {
          const color = FOOD_COLORS[f];
          const availCash = priv?.availableCash ?? 0;
          const availFood = priv?.availableInventory[f] ?? 0;
          const canBuy = bidPrices[f] <= availCash;
          const canAsk = availFood >= 1;
          return (
            <div key={f} className="grid grid-cols-2 gap-1.5 flex-1 min-h-0">
              <ScrollButton
                label={`buy ${FOOD_EMOJIS[f]}`}
                price={bidPrices[f]}
                onPriceChange={(p) =>
                  setBidPrices((cur) => ({ ...cur, [f]: p }))
                }
                onAction={() => placeOrder(f, "bid")}
                color={color}
                side="bid"
                disabled={disabled || !canBuy}
              />
              <ScrollButton
                label={`ask ${FOOD_EMOJIS[f]}`}
                price={askPrices[f]}
                onPriceChange={(p) =>
                  setAskPrices((cur) => ({ ...cur, [f]: p }))
                }
                onAction={() => placeOrder(f, "ask")}
                color={color}
                side="ask"
                disabled={disabled || !canAsk}
              />
            </div>
          );
        })}
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
    <div className="card px-2 py-1 shrink-0">
      <div className="flex items-center justify-between mb-0.5">
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
              className={`rounded-md border px-1.5 py-0.5 text-center ${
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
              <div className="text-[9px] text-muted leading-none">
                {p.status === "alive" ? "● alive" : "† dead"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
