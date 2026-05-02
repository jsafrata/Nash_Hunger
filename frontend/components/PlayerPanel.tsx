"use client";

import type { PublicPlayerState } from "../lib/types";
import { FOOD_DISPLAY_NAMES, FOOD_COLORS } from "../lib/types";

function fmtTime(s: number | null): string {
  if (s === null) return "—";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function PlayerPanel({
  players,
  selfId,
}: {
  players: PublicPlayerState[];
  selfId: string | null;
}) {
  return (
    <div className="card p-4">
      <div className="section-title mb-3">Players</div>
      <div className="space-y-1.5">
        {players.map((p) => {
          const isSelf = p.id === selfId;
          return (
            <div
              key={p.id}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-md border ${
                isSelf
                  ? "border-accent/40 bg-accent/5"
                  : "border-line bg-elevated/30"
              } ${p.status === "dead" ? "opacity-50" : ""}`}
            >
              {p.produces && (
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: FOOD_COLORS[p.produces] }}
                  title={FOOD_DISPLAY_NAMES[p.produces]}
                />
              )}
              <span className="text-sm font-medium truncate">{p.name}</span>
              {isSelf && <span className="text-[10px] text-accent">YOU</span>}
              {p.isBot && <span className="text-[10px] text-muted">BOT</span>}
              {p.isHost && (
                <span className="text-[10px] text-muted">HOST</span>
              )}
              <span className="ml-auto text-xs">
                {p.status === "alive" && (
                  <span className="text-bid">●</span>
                )}
                {p.status === "disconnected" && (
                  <span className="text-warn">●</span>
                )}
                {p.status === "dead" && (
                  <span className="text-danger mono tabular">
                    † {fmtTime(p.diedAtSecond)}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
