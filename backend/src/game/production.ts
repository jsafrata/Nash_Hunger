import { GAME_CONFIG } from "../config";
import type { GameRoom } from "../types";

export function produceFood(room: GameRoom): void {
  for (const player of room.players) {
    if (player.status !== "alive") continue;
    if (!player.produces) continue;
    player.inventory[player.produces] += GAME_CONFIG.PRODUCTION_PER_SECOND;
  }
}
