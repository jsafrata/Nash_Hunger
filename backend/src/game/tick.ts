import { GAME_CONFIG } from "../config";
import type { GameEndReason, GameRoom } from "../types";
import { produceFood } from "./production";
import { consumeFoodAndKill } from "./consumption";
import { killPlayer } from "./death";
import { buildFinalPlayerStates, determineWinners } from "./winner";
import { createEventId } from "../utils/ids";

export interface TickResult {
  deaths: { playerId: string; missingFoods: string[] }[];
  ended: boolean;
  endReason: GameEndReason | null;
}

export function gameTick(room: GameRoom): TickResult {
  const result: TickResult = { deaths: [], ended: false, endReason: null };

  if (room.phase !== "active") {
    result.ended = true;
    return result;
  }

  room.elapsedSeconds += 1;

  produceFood(room);

  const deathInfos = consumeFoodAndKill(room);
  for (const d of deathInfos) {
    const event = killPlayer(room, d.player, d.missingFoods);
    result.deaths.push({
      playerId: d.player.id,
      missingFoods: d.missingFoods,
    });
    void event;
  }

  const livingCount = room.players.filter((p) => p.status === "alive").length;

  if (room.elapsedSeconds >= room.maxSeconds) {
    endGame(room, "time_limit");
    result.ended = true;
    result.endReason = "time_limit";
    return result;
  }
  if (livingCount === 0) {
    endGame(room, "no_survivors");
    result.ended = true;
    result.endReason = "no_survivors";
    return result;
  }
  if (livingCount === 1) {
    endGame(room, "single_survivor");
    result.ended = true;
    result.endReason = "single_survivor";
    return result;
  }

  return result;
}

export function endGame(room: GameRoom, reason: GameEndReason): void {
  if (room.phase === "ended") return;
  room.phase = "ended";
  room.endReason = reason;
  if (room.tickInterval) {
    clearInterval(room.tickInterval);
    room.tickInterval = null;
  }
  const winners = determineWinners(room);
  room.winnerIds = winners.map((w) => w.id);

  room.eventLog.push({
    id: createEventId(),
    type: "game_ended",
    elapsedSecond: room.elapsedSeconds,
    timestamp: Date.now(),
    message:
      reason === "time_limit"
        ? "Game ended: time limit reached."
        : reason === "single_survivor"
          ? "Game ended: only one survivor remains."
          : "Game ended: all players are dead.",
    data: { reason, winnerIds: room.winnerIds },
  });
}

export function buildGameOverPayload(room: GameRoom) {
  return {
    winnerIds: room.winnerIds,
    reason: room.endReason ?? "time_limit",
    finalPlayers: buildFinalPlayerStates(room),
  };
}

export function startTickLoop(
  room: GameRoom,
  onTick: (room: GameRoom, result: TickResult) => void,
): void {
  if (room.tickInterval) return;
  room.tickInterval = setInterval(() => {
    if (room.phase !== "active") {
      if (room.tickInterval) {
        clearInterval(room.tickInterval);
        room.tickInterval = null;
      }
      return;
    }
    const result = gameTick(room);
    onTick(room, result);
  }, 1000);
}

export const _GAME_DURATION_SECONDS = GAME_CONFIG.GAME_DURATION_SECONDS;
