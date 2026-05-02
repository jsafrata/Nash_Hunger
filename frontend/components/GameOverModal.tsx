"use client";

import { useRouter } from "next/navigation";
import type { GameOverPayload } from "../lib/types";
import { FOOD_DISPLAY_NAMES, FOOD_COLORS } from "../lib/types";
import { clearSession } from "../lib/socket";

function fmtTime(s: number | null): string {
  if (s === null) return "—";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function GameOverModal({
  payload,
  selfId,
}: {
  payload: GameOverPayload;
  selfId: string | null;
}) {
  const router = useRouter();
  const winners = payload.finalPlayers.filter((p) =>
    payload.winnerIds.includes(p.id),
  );
  const winnerText =
    winners.length === 0
      ? "No survivors"
      : winners.length === 1
        ? `${winners[0].name} wins`
        : `Tie · ${winners.map((w) => w.name).join(", ")}`;
  const reasonText = {
    time_limit: "Time limit reached",
    single_survivor: "Last one standing",
    no_survivors: "Everyone starved",
  }[payload.reason];
  const sorted = [...payload.finalPlayers].sort((a, b) => {
    const aWin = payload.winnerIds.includes(a.id) ? 1 : 0;
    const bWin = payload.winnerIds.includes(b.id) ? 1 : 0;
    if (aWin !== bWin) return bWin - aWin;
    return b.finalCash - a.finalCash;
  });

  const goHome = () => {
    clearSession();
    router.push("/");
  };

  return (
    <div className="fixed inset-0 bg-bg/85 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card-elevated p-6 max-w-2xl w-full">
        <div className="text-center mb-5">
          <div className="text-xs text-muted uppercase tracking-wider mb-1">
            Game over · {reasonText}
          </div>
          <div className="text-3xl font-bold text-accent">{winnerText}</div>
        </div>

        <div className="space-y-1.5 mb-5">
          {sorted.map((p) => {
            const isWinner = payload.winnerIds.includes(p.id);
            const isSelf = p.id === selfId;
            return (
              <div
                key={p.id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md border ${
                  isWinner
                    ? "border-accent/50 bg-accent/10"
                    : "border-line bg-elevated/40"
                }`}
              >
                {isWinner && <span className="text-accent">★</span>}
                {p.produces && (
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: FOOD_COLORS[p.produces] }}
                    title={FOOD_DISPLAY_NAMES[p.produces]}
                  />
                )}
                <span
                  className={`font-medium ${
                    isWinner ? "text-accent" : ""
                  } ${isSelf ? "underline" : ""}`}
                >
                  {p.name}
                </span>
                {isSelf && <span className="text-[10px] text-accent">YOU</span>}
                <span className="ml-auto flex items-center gap-4 text-xs">
                  <span className="text-muted">
                    {p.status === "alive"
                      ? "alive"
                      : p.status === "dead"
                        ? `† ${fmtTime(p.diedAtSecond)}`
                        : "dc"}
                  </span>
                  <span className="text-muted mono tabular w-12 text-right">
                    +{p.totalBought}/-{p.totalSold}
                  </span>
                  <span className="font-bold text-base mono tabular text-accent w-16 text-right">
                    ${p.finalCash}
                  </span>
                </span>
              </div>
            );
          })}
        </div>

        <button onClick={goHome} className="btn btn-primary w-full">
          Back to home
        </button>
      </div>
    </div>
  );
}
