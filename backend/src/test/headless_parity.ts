/**
 * Headless game runner for parity testing against the Python research env.
 *
 * Reads a JSON spec on stdin:
 *   {
 *     "producers":  ["A","B","C","D"],   // by player index
 *     "deck":       ["A","A","B",...],   // 400 entries, dealt 100 to each player in order
 *     "actions":    [                     // length = number of ticks (≤ 180)
 *       { "0": {type:"noop"}, "1":{type:"trade",side:"bid",food:"A",qty:1,price:5},
 *         "2": {type:"cancel",side:"bid",food:"A"}, "3":{type:"cancel_all"} },
 *       ...
 *     ]
 *   }
 *
 * Writes a JSON record on stdout:
 *   { trades: [...], players: [...], end_reason, elapsed_seconds, winner_idxs }
 *
 * The TS canonical game logic (production, consumption, matching, etc.) is reused
 * unchanged — only the orchestration and RNG source differ.
 */

import { GAME_CONFIG } from "../config";
import { createEmptyOrderBooks } from "../game/setup";
import { produceFood } from "../game/production";
import { consumeFoodAndKill } from "../game/consumption";
import { killPlayer } from "../game/death";
import { determineWinners } from "../game/winner";
import {
  cancelAllOrdersForPlayer,
  cancelOrder,
  postOrder,
} from "../market/orderActions";
import { OrderValidationError } from "../market/validation";
import type { FoodType, GameRoom, Order, Player } from "../types";

interface ActionTrade {
  type: "trade";
  side: "bid" | "ask";
  food: FoodType;
  qty: number;
  price: number;
}
interface ActionCancel {
  type: "cancel";
  side: "bid" | "ask";
  food: FoodType;
}
interface ActionCancelAll {
  type: "cancel_all";
}
interface ActionNoop {
  type: "noop";
}
type Action = ActionTrade | ActionCancel | ActionCancelAll | ActionNoop;

interface Spec {
  producers: FoodType[];
  deck: FoodType[];
  actions: Array<Record<string, Action>>;
}

function emptyInventory() {
  return { A: 0, B: 0, C: 0, D: 0 } as Record<FoodType, number>;
}

function dealDeterministic(players: Player[], deck: FoodType[]) {
  let cursor = 0;
  for (const p of players) {
    p.inventory = emptyInventory();
    for (let i = 0; i < GAME_CONFIG.INITIAL_UNITS_PER_PLAYER; i++) {
      const f = deck[cursor++];
      p.inventory[f] += 1;
    }
  }
}

function buildRoom(spec: Spec): GameRoom {
  if (spec.producers.length !== GAME_CONFIG.PLAYER_COUNT) {
    throw new Error(`producers must have ${GAME_CONFIG.PLAYER_COUNT} entries`);
  }
  const expectedDeck = GAME_CONFIG.PLAYER_COUNT * GAME_CONFIG.INITIAL_UNITS_PER_PLAYER;
  if (spec.deck.length !== expectedDeck) {
    throw new Error(`deck must have ${expectedDeck} entries, got ${spec.deck.length}`);
  }

  const players: Player[] = spec.producers.map((produces, i) => ({
    id: `p${i}`,
    socketId: null,
    name: `P${i}`,
    isHost: i === 0,
    isBot: false,
    status: "alive",
    produces,
    cash: GAME_CONFIG.INITIAL_CASH,
    reservedCash: 0,
    inventory: emptyInventory(),
    reservedInventory: emptyInventory(),
    diedAtSecond: null,
    disconnectedAtSecond: null,
    totalBought: 0,
    totalSold: 0,
    cashFromTrades: 0,
    cashSpentOnTrades: 0,
  }));

  dealDeterministic(players, spec.deck);

  const room: GameRoom = {
    roomCode: "PARITY",
    phase: "active",
    players,
    orderBooks: createEmptyOrderBooks(),
    trades: [],
    eventLog: [],
    startedAt: 0,
    endsAt: 0,
    elapsedSeconds: 0,
    maxSeconds: GAME_CONFIG.GAME_DURATION_SECONDS,
    tickInterval: null,
    botIntervals: new Map(),
    rateLimits: new Map(),
    winnerIds: [],
    endReason: null,
  };
  return room;
}

function applyAction(room: GameRoom, playerIdx: number, action: Action): void {
  const player = room.players[playerIdx];
  if (player.status !== "alive") return; // dead players can't act
  if (action.type === "noop") return;
  try {
    if (action.type === "trade") {
      postOrder(room, {
        playerId: player.id,
        side: action.side,
        foodType: action.food,
        quantity: action.qty,
        pricePerUnit: action.price,
      });
    } else if (action.type === "cancel_all") {
      cancelAllOrdersForPlayer(room, player.id);
    } else if (action.type === "cancel") {
      // cancel the player's oldest open order on side+food
      const book = room.orderBooks[action.food];
      const pool = action.side === "bid" ? book.bids : book.asks;
      const own = pool.filter((o) => o.playerId === player.id);
      if (own.length === 0) return;
      own.sort((a, b) => a.createdAt - b.createdAt);
      cancelOrder(room, player.id, own[0].id);
    }
  } catch (e) {
    if (!(e instanceof OrderValidationError)) throw e;
    // illegal: silently no-op (matches the Python sim's behavior)
  }
}

function runTick(room: GameRoom, perPlayerAction: Record<string, Action>) {
  // 1. Apply actions in player_idx order
  for (let i = 0; i < GAME_CONFIG.PLAYER_COUNT; i++) {
    const a = perPlayerAction[String(i)] ?? { type: "noop" };
    applyAction(room, i, a);
  }
  // 2. Advance clock
  room.elapsedSeconds += 1;
  // 3. Production
  produceFood(room);
  // 4. Consumption + deaths
  const deaths = consumeFoodAndKill(room);
  for (const d of deaths) {
    killPlayer(room, d.player, d.missingFoods);
  }
  // 5. End-of-game checks
  const alive = room.players.filter((p) => p.status === "alive").length;
  if (room.elapsedSeconds >= room.maxSeconds) {
    room.phase = "ended";
    room.endReason = "time_limit";
  } else if (alive === 0) {
    room.phase = "ended";
    room.endReason = "no_survivors";
  } else if (alive === 1) {
    room.phase = "ended";
    room.endReason = "single_survivor";
  }
}

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let buf = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (buf += chunk));
    process.stdin.on("end", () => resolve(buf));
    process.stdin.on("error", (e) => reject(e));
  });
}

async function main() {
  const raw = await readStdin();
  const spec: Spec = JSON.parse(raw);
  const room = buildRoom(spec);

  for (const tickActions of spec.actions) {
    if (room.phase === "ended") break;
    runTick(room, tickActions);
  }

  const winners = determineWinners(room).map((w) => parseInt(w.id.slice(1), 10));
  room.winnerIds = winners.map((i) => `p${i}`);

  const output = {
    elapsed_seconds: room.elapsedSeconds,
    end_reason: room.endReason,
    winner_idxs: winners,
    trades: room.trades.map((t) => ({
      buyer_idx: parseInt(t.buyerId.slice(1), 10),
      seller_idx: parseInt(t.sellerId.slice(1), 10),
      food: t.foodType,
      price: t.pricePerUnit,
      qty: t.quantity,
      tick: t.elapsedSecond,
    })),
    players: room.players.map((p) => ({
      idx: parseInt(p.id.slice(1), 10),
      produces: p.produces,
      status: p.status,
      died_at: p.diedAtSecond,
      cash: p.cash,
      inventory: { ...p.inventory },
      total_bought: p.totalBought,
      total_sold: p.totalSold,
    })),
  };

  process.stdout.write(JSON.stringify(output));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
