"use client";

import type { GameEvent } from "../lib/types";

function fmtT(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

export function EventLog({ events }: { events: GameEvent[] }) {
  const reversed = [...events].reverse();
  return (
    <div className="card p-4">
      <div className="section-title mb-3">Event log</div>
      {reversed.length === 0 ? (
        <div className="text-xs text-muted italic">no events yet</div>
      ) : (
        <div className="max-h-40 overflow-y-auto space-y-1.5">
          {reversed.map((e) => (
            <div key={e.id} className="flex items-start gap-2 text-xs">
              <span className="text-muted mono tabular w-10 shrink-0">
                {fmtT(e.elapsedSecond)}
              </span>
              <span
                className={`flex-1 ${
                  e.type === "player_died"
                    ? "text-danger"
                    : e.type === "game_ended"
                      ? "text-accent font-medium"
                      : e.type === "game_started"
                        ? "text-bid"
                        : ""
                }`}
              >
                {e.message}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
