import type { GameRoom, Player, FoodType, GameEvent } from "../types";
import { cancelAllOrdersForPlayer } from "../market/orderActions";
import { createEventId } from "../utils/ids";
import { FOOD_DISPLAY_NAMES } from "../types";

export function killPlayer(
  room: GameRoom,
  player: Player,
  missingFoods: FoodType[],
): GameEvent {
  player.status = "dead";
  player.diedAtSecond = room.elapsedSeconds;

  cancelAllOrdersForPlayer(room, player.id, { releaseReservations: false });

  player.reservedCash = 0;
  player.reservedInventory = { A: 0, B: 0, C: 0, D: 0 };

  const missingNames = missingFoods.map((f) => FOOD_DISPLAY_NAMES[f]).join(", ");
  const event: GameEvent = {
    id: createEventId(),
    type: "player_died",
    elapsedSecond: room.elapsedSeconds,
    timestamp: Date.now(),
    message: `${player.name} died because they ran out of ${missingNames}.`,
    data: {
      playerId: player.id,
      missingFoods,
    },
  };
  room.eventLog.push(event);
  return event;
}
