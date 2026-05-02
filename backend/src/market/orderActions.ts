import type { GameRoom, Order, PostOrderInput, Trade } from "../types";
import { FOOD_TYPES } from "../types";
import { createOrderId } from "../utils/ids";
import { findPlayerById } from "../rooms";
import {
  validatePostOrder,
  checkRateLimitForOrder,
  checkRateLimitForCancel,
  OrderValidationError,
} from "./validation";
import { reserveForOrder, releaseRemainingReservation } from "./reservations";
import { matchIncomingOrder } from "./matching";
import { removeOrderFromBook, findOrderInBook } from "./orderBook";

export interface PostOrderResult {
  order: Order;
  trades: Trade[];
}

export function postOrder(
  room: GameRoom,
  input: PostOrderInput,
): PostOrderResult {
  const player = findPlayerById(room, input.playerId);
  if (!player) {
    throw new OrderValidationError("player_not_found", "Player not found.");
  }

  validatePostOrder(room, player, input);
  checkRateLimitForOrder(room, player.id, room.elapsedSeconds);

  const now = Date.now();
  const order: Order = {
    id: createOrderId(),
    playerId: player.id,
    foodType: input.foodType,
    side: input.side,
    pricePerUnit: input.pricePerUnit,
    originalQuantity: input.quantity,
    remainingQuantity: input.quantity,
    status: "open",
    createdAt: now,
    updatedAt: now,
  };

  reserveForOrder(player, order);

  const trades = matchIncomingOrder(room, order);

  return { order, trades };
}

export function cancelOrder(
  room: GameRoom,
  playerId: string,
  orderId: string,
): Order {
  const player = findPlayerById(room, playerId);
  if (!player) {
    throw new OrderValidationError("player_not_found", "Player not found.");
  }
  if (room.phase !== "active") {
    throw new OrderValidationError("game_not_active", "Game is not active.");
  }

  let foundOrder: Order | undefined;
  for (const f of FOOD_TYPES) {
    const candidate = findOrderInBook(room.orderBooks[f], orderId);
    if (candidate) {
      foundOrder = candidate;
      break;
    }
  }
  if (!foundOrder) {
    throw new OrderValidationError("order_not_found", "Order not found.");
  }
  if (foundOrder.playerId !== playerId) {
    throw new OrderValidationError(
      "not_order_owner",
      "You do not own this order.",
    );
  }
  if (foundOrder.status === "filled" || foundOrder.status === "cancelled") {
    throw new OrderValidationError(
      "order_not_cancellable",
      "Order is already finalized.",
    );
  }

  checkRateLimitForCancel(room, player.id, room.elapsedSeconds);

  releaseRemainingReservation(player, foundOrder);
  foundOrder.status = "cancelled";
  foundOrder.updatedAt = Date.now();
  removeOrderFromBook(room.orderBooks[foundOrder.foodType], foundOrder.id);

  return foundOrder;
}

export function cancelAllOrdersForPlayer(
  room: GameRoom,
  playerId: string,
  options: { releaseReservations: boolean } = { releaseReservations: true },
): Order[] {
  const player = findPlayerById(room, playerId);
  if (!player) return [];

  const cancelled: Order[] = [];
  for (const f of FOOD_TYPES) {
    const book = room.orderBooks[f];
    const ownBids = book.bids.filter((o) => o.playerId === playerId);
    const ownAsks = book.asks.filter((o) => o.playerId === playerId);
    for (const o of [...ownBids, ...ownAsks]) {
      if (options.releaseReservations) {
        releaseRemainingReservation(player, o);
      }
      o.status = "cancelled";
      o.updatedAt = Date.now();
      removeOrderFromBook(book, o.id);
      cancelled.push(o);
    }
  }
  return cancelled;
}
