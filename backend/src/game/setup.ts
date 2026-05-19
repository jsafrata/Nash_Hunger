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

/**
 * Deal initial food to each player while guaranteeing every player gets
 * at least MIN_INITIAL_UNITS_PER_FOOD_PER_PLAYER of each food type. The
 * remaining capacity is filled randomly from the supplied (shuffled) deck.
 *
 * The deck is assumed to already contain INITIAL_UNITS_PER_FOOD_TYPE units
 * of each food. After dealing the guaranteed portion, the remainder of the
 * deck (still shuffled) is dealt round-robin to top up each player to
 * INITIAL_UNITS_PER_PLAYER total.
 */
export function dealInitialFood(players: Player[], deck: FoodType[]): void {
  const config = GAME_CONFIG;
  const minPer = config.MIN_INITIAL_UNITS_PER_FOOD_PER_PLAYER;
  const perPlayer = config.INITIAL_UNITS_PER_PLAYER;
  const perFood = config.INITIAL_UNITS_PER_FOOD_TYPE;

  // Sanity: guarantee has to be feasible.
  if (minPer * config.PLAYER_COUNT > perFood) {
    throw new Error(
      `MIN_INITIAL_UNITS_PER_FOOD_PER_PLAYER (${minPer}) × players ` +
        `(${config.PLAYER_COUNT}) exceeds INITIAL_UNITS_PER_FOOD_TYPE (${perFood})`,
    );
  }
  if (minPer * config.FOOD_TYPES.length > perPlayer) {
    throw new Error(
      `min per food × food types (${minPer * config.FOOD_TYPES.length}) ` +
        `exceeds INITIAL_UNITS_PER_PLAYER (${perPlayer})`,
    );
  }

  for (const player of players) {
    player.inventory = emptyInventory();
  }

  // Bucket the deck by food type (preserving the deck's existing shuffled order
  // within each bucket so the "random extra" portion remains shuffled).
  const buckets: Record<FoodType, FoodType[]> = {
    A: [],
    B: [],
    C: [],
    D: [],
  };
  for (const f of deck) buckets[f].push(f);

  // Phase 1: pull `minPer` of each food per player out of the buckets.
  for (const food of config.FOOD_TYPES) {
    for (const player of players) {
      for (let i = 0; i < minPer; i++) {
        const card = buckets[food].pop();
        if (!card) throw new Error(`bucket ${food} exhausted during guarantee`);
        player.inventory[food] += 1;
      }
    }
  }

  // Phase 2: reassemble the remaining cards into one pool (still shuffled
  // because each bucket retained its relative order), and deal round-robin
  // until every player hits INITIAL_UNITS_PER_PLAYER.
  const remaining: FoodType[] = [];
  for (const f of config.FOOD_TYPES) remaining.push(...buckets[f]);
  // The remaining pool is the original deck minus what we already pulled, but
  // shuffled within each food. Mix it once more to interleave foods.
  for (let i = remaining.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
  }
  let idx = 0;
  for (const player of players) {
    while (
      Object.values(player.inventory).reduce((a, b) => a + b, 0) < perPlayer
    ) {
      const card = remaining[idx++];
      if (!card) throw new Error("remaining pool exhausted during top-up");
      player.inventory[card] += 1;
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
