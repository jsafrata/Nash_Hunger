"use client";

import type {
  FoodType,
  PublicPlayerState,
  PublicTrade,
} from "../lib/types";
import {
  FOOD_EMOJIS,
  FOOD_TYPES,
  FOOD_COLORS,
} from "../lib/types";

const RECENT_TICK_WINDOW = 8; // how many ticks of trade history to summarise

interface OpponentBoxProps {
  player: PublicPlayerState;
  deltas: Record<FoodType, number>;
}

function OpponentBox({ player, deltas }: OpponentBoxProps) {
  const dead = player.status === "dead";
  return (
    <div
      className={`flex-1 rounded-md border p-2 ${
        dead ? "opacity-50 border-line" : "border-line bg-elevated/30"
      }`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        {player.produces && (
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: FOOD_COLORS[player.produces] }}
          />
        )}
        <span className="text-xs font-medium truncate flex-1">
          {player.name}
        </span>
        {player.isBot && (
          <span className="text-[9px] text-muted">BOT</span>
        )}
        {dead && <span className="text-[9px] text-danger">DEAD</span>}
      </div>
      <div className="flex justify-between gap-1">
        {FOOD_TYPES.map((f) => {
          const d = deltas[f];
          return (
            <div
              key={f}
              className="flex flex-col items-center text-[10px] mono tabular"
            >
              <span className="text-sm leading-none">{FOOD_EMOJIS[f]}</span>
              <span
                className={
                  d > 0
                    ? "text-bid font-semibold"
                    : d < 0
                      ? "text-ask font-semibold"
                      : "text-muted/50"
                }
              >
                {d > 0 ? `+${d}` : d < 0 ? `${d}` : "·"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function OpponentsRow({
  players,
  selfId,
  recentTrades,
  currentTick,
}: {
  players: PublicPlayerState[];
  selfId: string | null;
  recentTrades: PublicTrade[];
  currentTick: number;
}) {
  const opponents = players.filter((p) => p.id !== selfId);

  // Compute per-opponent, per-food net delta over the recent window.
  const deltas: Record<string, Record<FoodType, number>> = {};
  for (const p of opponents) {
    deltas[p.id] = { A: 0, B: 0, C: 0, D: 0 };
  }
  for (const t of recentTrades) {
    if (currentTick - t.elapsedSecond > RECENT_TICK_WINDOW) continue;
    if (deltas[t.buyerId]) deltas[t.buyerId][t.foodType] += t.quantity;
    if (deltas[t.sellerId]) deltas[t.sellerId][t.foodType] -= t.quantity;
  }

  return (
    <div className="card p-2">
      <div className="flex gap-2">
        {opponents.length === 0 ? (
          <div className="text-xs text-muted italic px-2 py-2">
            no opponents yet
          </div>
        ) : (
          opponents.map((p) => (
            <OpponentBox key={p.id} player={p} deltas={deltas[p.id]} />
          ))
        )}
      </div>
    </div>
  );
}
