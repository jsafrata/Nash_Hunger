import { GAME_CONFIG } from "../config";
import type {
  FoodType,
  GameRoom,
  Player,
  OrderBook,
} from "../types";
import { FOOD_TYPES } from "../types";
import { shuffle } from "../utils/shuffle";
import { emptyInventory } from "../utils/inventory";

export function createInitialDeck(): FoodType[] {
  const deck: FoodType[] = [];
  for (const food of FOOD_TYPES) {
    for (let i = 0; i < GAME_CONFIG.INITIAL_UNITS_PER_FOOD_TYPE; i++) {
      deck.push(food);
    }
  }
  return shuffle(deck);
}

export function dealInitialFood(players: Player[], deck: FoodType[]): void {
  for (const player of players) {
    player.inventory = emptyInventory();
    for (let i = 0; i < GAME_CONFIG.INITIAL_UNITS_PER_PLAYER; i++) {
      const food = deck.pop();
      if (!food) throw new Error("Deck exhausted");
      player.inventory[food] += 1;
    }
  }
}

export function assignProducerFoodTypes(players: Player[]): void {
  if (players.length !== GAME_CONFIG.PLAYER_COUNT) {
    throw new Error(
      `Need exactly ${GAME_CONFIG.PLAYER_COUNT} players to assign producers`,
    );
  }
  const shuffledFoods = shuffle([...FOOD_TYPES]);
  for (let i = 0; i < players.length; i++) {
    players[i].produces = shuffledFoods[i];
  }
}

export function createEmptyOrderBooks(): Record<FoodType, OrderBook> {
  return {
    A: { foodType: "A", bids: [], asks: [] },
    B: { foodType: "B", bids: [], asks: [] },
    C: { foodType: "C", bids: [], asks: [] },
    D: { foodType: "D", bids: [], asks: [] },
  };
}

export function startGame(room: GameRoom): void {
  if (room.phase !== "lobby") {
    throw new Error("Game already started");
  }
  if (room.players.length !== GAME_CONFIG.PLAYER_COUNT) {
    throw new Error(
      `Need exactly ${GAME_CONFIG.PLAYER_COUNT} players to start`,
    );
  }

  assignProducerFoodTypes(room.players);

  const deck = createInitialDeck();
  dealInitialFood(room.players, deck);

  for (const p of room.players) {
    p.cash = GAME_CONFIG.INITIAL_CASH;
    p.reservedCash = 0;
    p.reservedInventory = emptyInventory();
    p.status = "alive";
    p.diedAtSecond = null;
    p.disconnectedAtSecond = null;
    p.totalBought = 0;
    p.totalSold = 0;
    p.cashFromTrades = 0;
    p.cashSpentOnTrades = 0;
  }

  room.orderBooks = createEmptyOrderBooks();
  room.trades = [];
  room.eventLog = [];
  room.phase = "active";
  room.startedAt = Date.now();
  room.endsAt = room.startedAt + GAME_CONFIG.GAME_DURATION_SECONDS * 1000;
  room.elapsedSeconds = 0;
  room.maxSeconds = GAME_CONFIG.GAME_DURATION_SECONDS;
  room.winnerIds = [];
  room.endReason = null;
}
