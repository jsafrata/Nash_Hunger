import type { GameRoom, Player, FinalPlayerState } from "../types";
import { totalInventory } from "../utils/inventory";

export function determineWinners(room: GameRoom): Player[] {
  const survivors = room.players.filter((p) => p.status === "alive");

  if (survivors.length === 0) return [];
  if (survivors.length === 1) return [survivors[0]];

  const maxCash = Math.max(...survivors.map((p) => p.cash));
  const cashLeaders = survivors.filter((p) => p.cash === maxCash);
  if (cashLeaders.length === 1) return cashLeaders;

  const maxFood = Math.max(
    ...cashLeaders.map((p) => totalInventory(p.inventory)),
  );
  return cashLeaders.filter((p) => totalInventory(p.inventory) === maxFood);
}

export function buildFinalPlayerStates(room: GameRoom): FinalPlayerState[] {
  return room.players.map((p) => ({
    id: p.id,
    name: p.name,
    produces: p.produces,
    status: p.status,
    diedAtSecond: p.diedAtSecond,
    finalCash: p.cash,
    finalInventory: { ...p.inventory },
    totalBought: p.totalBought,
    totalSold: p.totalSold,
    cashFromTrades: p.cashFromTrades,
    cashSpentOnTrades: p.cashSpentOnTrades,
  }));
}
