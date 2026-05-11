import { GAME_CONFIG } from "../config";
import type {
  FoodType,
  GameRoom,
  PublicGameState,
  PublicOrderBook,
  PublicOrderBookLevel,
  PublicPlayerState,
  PublicTrade,
} from "../types";
import { FOOD_TYPES } from "../types";

function aggregateLevels(orders: { pricePerUnit: number; remainingQuantity: number }[]): PublicOrderBookLevel[] {
  const map = new Map<number, number>();
  for (const o of orders) {
    map.set(o.pricePerUnit, (map.get(o.pricePerUnit) ?? 0) + o.remainingQuantity);
  }
  return Array.from(map.entries()).map(([pricePerUnit, totalQuantity]) => ({
    pricePerUnit,
    totalQuantity,
  }));
}

export function buildPublicOrderBook(
  room: GameRoom,
  foodType: FoodType,
): PublicOrderBook {
  const book = room.orderBooks[foodType];
  const bids = aggregateLevels(book.bids).sort(
    (a, b) => b.pricePerUnit - a.pricePerUnit,
  );
  const asks = aggregateLevels(book.asks).sort(
    (a, b) => a.pricePerUnit - b.pricePerUnit,
  );

  const lastTradeForFood = [...room.trades]
    .reverse()
    .find((t) => t.foodType === foodType);

  return {
    foodType,
    bids: bids.slice(0, GAME_CONFIG.PUBLIC_ORDER_BOOK_DEPTH),
    asks: asks.slice(0, GAME_CONFIG.PUBLIC_ORDER_BOOK_DEPTH),
    lastTradePrice: lastTradeForFood?.pricePerUnit ?? null,
    lastTradeQuantity: lastTradeForFood?.quantity ?? null,
  };
}

export function buildAllPublicOrderBooks(
  room: GameRoom,
): Record<FoodType, PublicOrderBook> {
  return {
    A: buildPublicOrderBook(room, "A"),
    B: buildPublicOrderBook(room, "B"),
    C: buildPublicOrderBook(room, "C"),
    D: buildPublicOrderBook(room, "D"),
  };
}

export function buildPublicPlayers(room: GameRoom): PublicPlayerState[] {
  return room.players.map((p) => ({
    id: p.id,
    name: p.name,
    isHost: p.isHost,
    isBot: p.isBot,
    status: p.status,
    produces: p.produces,
    diedAtSecond: p.diedAtSecond,
  }));
}

export function buildPublicTrades(room: GameRoom): PublicTrade[] {
  const recent = room.trades.slice(-GAME_CONFIG.RECENT_TRADES_LIMIT);
  return recent.map((t) => {
    const buyer = room.players.find((p) => p.id === t.buyerId);
    const seller = room.players.find((p) => p.id === t.sellerId);
    return {
      id: t.id,
      foodType: t.foodType,
      buyerId: t.buyerId,
      buyerName: buyer?.name ?? "?",
      sellerId: t.sellerId,
      sellerName: seller?.name ?? "?",
      pricePerUnit: t.pricePerUnit,
      quantity: t.quantity,
      totalPrice: t.totalPrice,
      elapsedSecond: t.elapsedSecond,
    };
  });
}

export function buildPublicGameState(room: GameRoom): PublicGameState {
  const remainingSeconds = Math.max(0, room.maxSeconds - room.elapsedSeconds);
  return {
    roomCode: room.roomCode,
    phase: room.phase,
    elapsedSeconds: room.elapsedSeconds,
    remainingSeconds,
    maxSeconds: room.maxSeconds,
    players: buildPublicPlayers(room),
    recentTrades: buildPublicTrades(room),
    publicEventLog: room.eventLog.slice(-GAME_CONFIG.EVENT_LOG_LIMIT),
    botDifficulty: room.botDifficulty,
    consumptionIntervalSeconds: GAME_CONFIG.CONSUMPTION_INTERVAL_SECONDS,
  };
}

export const _FOOD_TYPES = FOOD_TYPES;
