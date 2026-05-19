"use client";

import type { PublicGameState } from "../lib/types";
import { Logo } from "./Logo";

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function TimerBar({
  publicState,
  connected,
  roomCode,
}: {
  publicState: PublicGameState | null;
  connected: boolean;
  roomCode: string;
}) {
  const phase = publicState?.phase ?? "lobby";
  const remaining = publicState?.remainingSeconds ?? 180;
  const total = publicState?.maxSeconds ?? 180;
  const elapsed = total - remaining;
  const progress = phase === "lobby" ? 0 : Math.min(100, (elapsed / total) * 100);
  const alive = publicState?.players.filter((p) => p.status === "alive").length ?? 0;
  const seats = publicState?.players.length ?? 0;

  const timeColor =
    phase === "lobby"
      ? "text-muted"
      : remaining <= 30
        ? "text-danger"
        : remaining <= 60
          ? "text-warn"
          : "text-text";

  return (
    <div className="card px-5 py-3">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Logo size={28} />
          <span className="font-bold text-accent text-base tracking-tight">
            Nash Hunger
          </span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="section-title">Room</span>
          <span className="font-bold text-accent text-lg mono">{roomCode}</span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="section-title">Time</span>
          <span className={`font-bold text-2xl tabular mono ${timeColor}`}>
            {phase === "lobby" ? "—:—" : fmtTime(remaining)}
          </span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="section-title">Alive</span>
          <span className="font-bold text-lg mono">
            {alive}
            <span className="text-muted">/{seats}</span>
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2 text-xs text-muted">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              connected ? "bg-bid" : "bg-danger"
            }`}
          />
          {connected ? "connected" : "reconnecting…"}
        </div>
      </div>

      {phase !== "lobby" && (
        <div className="mt-2 h-1 bg-line rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-1000 ease-linear ${
              remaining <= 30
                ? "bg-danger"
                : remaining <= 60
                  ? "bg-warn"
                  : "bg-accent"
            }`}
            style={{ width: `${100 - progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
