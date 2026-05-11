"use client";

import type { Socket } from "socket.io-client";
import type { BotDifficulty, PublicPlayerState } from "../lib/types";

const FULL_COUNT = 4;
const DIFFICULTIES: { value: BotDifficulty; label: string; hint: string }[] = [
  { value: "easy", label: "Easy", hint: "slow bots (3.5–5.5s)" },
  { value: "medium", label: "Medium", hint: "balanced (1.5–2.5s)" },
  { value: "hard", label: "Hard", hint: "fast bots (0.5–1.0s)" },
];

export function Lobby({
  socket,
  roomCode,
  playerId,
  isHost,
  players,
  botDifficulty,
  consumptionIntervalSeconds,
}: {
  socket: Socket | null;
  roomCode: string;
  playerId: string;
  isHost: boolean;
  players: PublicPlayerState[];
  botDifficulty: BotDifficulty;
  consumptionIntervalSeconds: number;
}) {
  const start = () => socket?.emit("start_game", { roomCode, playerId });
  const addBot = () => socket?.emit("add_bot", { roomCode, playerId });
  const removeBot = (botId: string) =>
    socket?.emit("remove_bot", { roomCode, playerId, botId });
  const setDifficulty = (difficulty: BotDifficulty) =>
    socket?.emit("set_bot_difficulty", {
      roomCode,
      playerId,
      difficulty,
    });
  const fillWithBots = () => {
    const empty = FULL_COUNT - players.length;
    for (let i = 0; i < empty; i++) {
      socket?.emit("add_bot", { roomCode, playerId });
    }
  };

  const canStart = players.length === FULL_COUNT && isHost;
  const canAddBot = isHost && players.length < FULL_COUNT;
  const hasBots = players.some((p) => p.isBot);
  const inviteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/game/${roomCode}`
      : "";

  const copyInvite = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(inviteUrl).catch(() => {});
    }
  };

  return (
    <div className="card p-6 max-w-lg w-full">
      <div className="text-xs text-muted uppercase tracking-wider mb-1">
        Lobby
      </div>
      <div className="flex items-baseline gap-3 mb-5">
        <div className="text-3xl font-bold mono text-accent tracking-wider">
          {roomCode}
        </div>
        <button onClick={copyInvite} className="btn-ghost text-xs">
          copy invite link
        </button>
      </div>

      <div className="flex items-center justify-between mb-2">
        <div className="section-title">
          Players · {players.length}/{FULL_COUNT}
        </div>
        {isHost && (
          <div className="flex gap-1">
            <button
              onClick={addBot}
              disabled={!canAddBot}
              className="btn-ghost text-xs"
            >
              + bot
            </button>
            <button
              onClick={fillWithBots}
              disabled={!canAddBot}
              className="btn-ghost text-xs"
            >
              fill with bots
            </button>
          </div>
        )}
      </div>

      <div className="space-y-1.5 mb-5">
        {Array.from({ length: FULL_COUNT }).map((_, i) => {
          const p = players[i];
          if (!p) {
            return (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-2.5 rounded-md border border-dashed border-line/40 text-muted italic text-sm"
              >
                empty seat
              </div>
            );
          }
          return (
            <div
              key={p.id}
              className="flex items-center gap-2 px-3 py-2.5 rounded-md border border-line bg-elevated/40"
            >
              <span className="text-sm font-medium">{p.name}</span>
              {p.id === playerId && (
                <span className="text-[10px] text-accent">YOU</span>
              )}
              {p.isBot && <span className="text-[10px] text-muted">BOT</span>}
              {p.isHost && (
                <span className="text-[10px] text-muted ml-auto">HOST</span>
              )}
              {isHost && p.isBot && (
                <button
                  onClick={() => removeBot(p.id)}
                  className="btn-ghost text-[11px] ml-auto"
                >
                  kick
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className={`mb-5 ${hasBots ? "" : "opacity-60"}`}>
        <div className="section-title mb-2">Bot difficulty</div>
        <div className="grid grid-cols-3 gap-2">
          {DIFFICULTIES.map((d) => {
            const active = d.value === botDifficulty;
            return (
              <button
                key={d.value}
                onClick={() => setDifficulty(d.value)}
                disabled={!isHost}
                className={`px-3 py-2 rounded-md border text-sm transition ${
                  active
                    ? "bg-accent/20 border-accent text-accent"
                    : "border-line text-muted hover:bg-elevated/40"
                } disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                <div className="font-semibold">{d.label}</div>
                <div className="text-[10px] opacity-70">{d.hint}</div>
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={start}
        disabled={!canStart}
        className="btn btn-primary w-full"
      >
        {isHost
          ? canStart
            ? "Start game →"
            : `Need ${FULL_COUNT - players.length} more`
          : "Waiting for host to start…"}
      </button>

      <div className="mt-5 text-xs text-muted leading-relaxed">
        Each player produces one food (+2/s) and must eat the other three
        (−1 every {consumptionIntervalSeconds}s). Trade through the order book.
        The surviving player with the most cash after 3 minutes wins. Reserved
        food in your asks cannot be eaten.
      </div>
    </div>
  );
}
