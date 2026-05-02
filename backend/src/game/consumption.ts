import { GAME_CONFIG } from "../config";
import type { FoodType, GameRoom, Player } from "../types";
import { requiredFoods } from "../utils/inventory";

export interface DeathInfo {
  player: Player;
  missingFoods: FoodType[];
}

export function consumeFoodAndKill(room: GameRoom): DeathInfo[] {
  const deaths: DeathInfo[] = [];
  const consumeAmount = GAME_CONFIG.CONSUMPTION_PER_REQUIRED_FOOD_PER_SECOND;

  for (const player of room.players) {
    if (player.status !== "alive") continue;

    const required = requiredFoods(player.produces);
    const missing: FoodType[] = [];
    for (const f of required) {
      const available = player.inventory[f] - player.reservedInventory[f];
      if (available < consumeAmount) missing.push(f);
    }

    if (missing.length > 0) {
      deaths.push({ player, missingFoods: missing });
      continue;
    }

    for (const f of required) {
      player.inventory[f] -= consumeAmount;
    }
  }

  return deaths;
}
