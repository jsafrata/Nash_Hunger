import { GAME_CONFIG } from "../config";
import type { GameRoom, PostOrderInput, Player } from "../types";
import { FOOD_TYPES } from "../types";

export class OrderValidationError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export function validatePostOrder(
  room: GameRoom,
  player: Player,
  input: PostOrderInput,
): void {
  if (room.phase !== "active") {
    throw new OrderValidationError("game_not_active", "Game is not active.");
  }
  if (player.status !== "alive") {
    throw new OrderValidationError("player_dead", "You are not alive.");
  }
  if (!FOOD_TYPES.includes(input.foodType)) {
    throw new OrderValidationError("bad_food_type", "Invalid food type.");
  }
  if (input.side !== "bid" && input.side !== "ask") {
    throw new OrderValidationError("bad_side", "Side must be bid or ask.");
  }
  if (!Number.isInteger(input.quantity)) {
    throw new OrderValidationError(
      "non_integer_quantity",
      "Quantity must be a whole number.",
    );
  }
  if (input.quantity < GAME_CONFIG.MIN_ORDER_QUANTITY) {
    throw new OrderValidationError(
      "quantity_too_small",
      `Quantity must be at least ${GAME_CONFIG.MIN_ORDER_QUANTITY}.`,
    );
  }
  if (!Number.isInteger(input.pricePerUnit)) {
    throw new OrderValidationError(
      "non_integer_price",
      "Price must be a whole number.",
    );
  }
  if (input.pricePerUnit < GAME_CONFIG.MIN_PRICE) {
    throw new OrderValidationError(
      "negative_price",
      "Price cannot be negative.",
    );
  }

  const ownOpenOrders = countOpenOrders(room, player.id);
  if (ownOpenOrders >= GAME_CONFIG.MAX_OPEN_ORDERS_PER_PLAYER) {
    throw new OrderValidationError(
      "too_many_open_orders",
      `You have too many open orders (max ${GAME_CONFIG.MAX_OPEN_ORDERS_PER_PLAYER}).`,
    );
  }

  if (input.side === "bid") {
    const cost = input.pricePerUnit * input.quantity;
    const available = player.cash - player.reservedCash;
    if (cost > available) {
      throw new OrderValidationError(
        "insufficient_cash",
        `You do not have enough available cash for this bid (need ${cost}, have ${available}).`,
      );
    }
  } else {
    const available =
      player.inventory[input.foodType] - player.reservedInventory[input.foodType];
    if (input.quantity > available) {
      throw new OrderValidationError(
        "insufficient_inventory",
        `You do not have enough available ${input.foodType} for this ask (need ${input.quantity}, have ${available}).`,
      );
    }
  }
}

function countOpenOrders(room: GameRoom, playerId: string): number {
  let count = 0;
  for (const f of FOOD_TYPES) {
    const book = room.orderBooks[f];
    for (const o of book.bids) if (o.playerId === playerId) count++;
    for (const o of book.asks) if (o.playerId === playerId) count++;
  }
  return count;
}

export function checkRateLimitForOrder(
  room: GameRoom,
  playerId: string,
  nowSec: number,
): void {
  const state = room.rateLimits.get(playerId) ?? {
    ordersThisSecond: 0,
    cancelsThisSecond: 0,
    windowStart: nowSec,
  };
  if (state.windowStart !== nowSec) {
    state.windowStart = nowSec;
    state.ordersThisSecond = 0;
    state.cancelsThisSecond = 0;
  }
  if (
    state.ordersThisSecond >= GAME_CONFIG.MAX_NEW_ORDERS_PER_PLAYER_PER_SECOND
  ) {
    room.rateLimits.set(playerId, state);
    throw new OrderValidationError(
      "rate_limit_orders",
      "Too many actions. Slow down.",
    );
  }
  state.ordersThisSecond += 1;
  room.rateLimits.set(playerId, state);
}

export function checkRateLimitForCancel(
  room: GameRoom,
  playerId: string,
  nowSec: number,
): void {
  const state = room.rateLimits.get(playerId) ?? {
    ordersThisSecond: 0,
    cancelsThisSecond: 0,
    windowStart: nowSec,
  };
  if (state.windowStart !== nowSec) {
    state.windowStart = nowSec;
    state.ordersThisSecond = 0;
    state.cancelsThisSecond = 0;
  }
  if (
    state.cancelsThisSecond >= GAME_CONFIG.MAX_CANCELS_PER_PLAYER_PER_SECOND
  ) {
    room.rateLimits.set(playerId, state);
    throw new OrderValidationError(
      "rate_limit_cancels",
      "Too many actions. Slow down.",
    );
  }
  state.cancelsThisSecond += 1;
  room.rateLimits.set(playerId, state);
}
