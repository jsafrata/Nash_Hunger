import type {
  FoodType,
  GameRoom,
  OwnOrderView,
  Player,
  PrivatePlayerState,
} from "../types";
import { FOOD_TYPES } from "../types";
import { availableInventory, requiredFoods } from "../utils/inventory";
import { GAME_CONFIG } from "../config";

export function buildPrivatePlayerState(player: Player): PrivatePlayerState {
  const avail = availableInventory(player.inventory, player.reservedInventory);
  const required = requiredFoods(player.produces);
  const consume = GAME_CONFIG.CONSUMPTION_PER_REQUIRED_FOOD_PER_SECOND;
  const secondsUntilStarvation: Partial<Record<FoodType, number>> = {};
  for (const f of required) {
    secondsUntilStarvation[f] = Math.max(0, Math.floor(avail[f] / consume));
  }

  return {
    playerId: player.id,
    cash: player.cash,
    reservedCash: player.reservedCash,
    availableCash: player.cash - player.reservedCash,
    inventory: { ...player.inventory },
    reservedInventory: { ...player.reservedInventory },
    availableInventory: avail,
    produces: player.produces,
    requiredFoods: required,
    secondsUntilStarvation,
  };
}

export function buildOwnOrders(
  room: GameRoom,
  playerId: string,
): OwnOrderView[] {
  const out: OwnOrderView[] = [];
  for (const f of FOOD_TYPES) {
    const book = room.orderBooks[f];
    for (const o of [...book.bids, ...book.asks]) {
      if (o.playerId === playerId) {
        out.push({
          id: o.id,
          foodType: o.foodType,
          side: o.side,
          pricePerUnit: o.pricePerUnit,
          originalQuantity: o.originalQuantity,
          remainingQuantity: o.remainingQuantity,
          status: o.status,
          createdAt: o.createdAt,
        });
      }
    }
  }
  out.sort((a, b) => a.createdAt - b.createdAt);
  return out;
}
