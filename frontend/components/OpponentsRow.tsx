"use client";

import type {
  FoodType,
  PublicPlayerState,
  PublicTrade,
} from "../lib/types";
import {
  FOOD_COLORS,
  FOOD_EMOJIS,
  FOOD_TYPES,
} from "../lib/types";

const RECENT_TICK_WINDOW = 8;

interface OpponentBoxProps {
  player: PublicPlayerState;
  deltas: Record<FoodType, number>;
}

function OpponentBox({ player, deltas }: OpponentBoxProps) {
  const dead = player.status === "dead";
  const color = player.produces ? FOOD_COLORS[player.produces] : "#7c8390";
  const bg = dead ? "#13161e" : `${color}1f`;
  const border = dead ? "#252a36" : `${color}66`;

  return (
    <div
      className={`flex-1 rounded-md border px-3 py-2 ${
        dead ? "opacity-50" : ""
      }`}
      style={{ background: bg, borderColor: border }}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <span
          className="text-sm font-semibold truncate flex-1"
          style={{ color }}
        >
          {player.name}
        </span>
        {player.isBot && (
          <span className="text-[9px] text-muted">BOT</span>
        )}
      </div>
      <div className="flex justify-between gap-2">
        {FOOD_TYPES.map((f) => {
          const d = deltas[f];
          const isOwn = player.produces === f;
          return (
            <div
              key={f}
              className="flex flex-col items-center text-[10px] mono tabular"
            >
              <span
                className={`text-base leading-none ${isOwn ? "" : "opacity-80"}`}
              >
                {FOOD_EMOJIS[f]}
              </span>
              <span
                className={
                  d > 0
                    ? "text-bid font-semibold"
                    : d < 0
                      ? "text-ask font-semibold"
                      : "text-muted/40"
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
  );
}
