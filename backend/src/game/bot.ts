import type { GameRoom, FoodType, Player, Trade } from "../types";
import { FOOD_TYPES } from "../types";
import { postOrder } from "../market/orderActions";
import { OrderValidationError } from "../market/validation";
import { availableInventory, requiredFoods } from "../utils/inventory";

const BOT_NAMES = [
  "Bot Casey",
  "Bot River",
  "Bot Quinn",
  "Bot Sage",
  "Bot Avery",
  "Bot Drew",
];

export function pickBotName(taken: Set<string>): string {
  for (const name of BOT_NAMES) {
    if (!taken.has(name)) return name;
  }
  return `Bot ${Math.floor(Math.random() * 1000)}`;
}

function lastTradePriceFor(
  room: GameRoom,
  food: FoodType,
): number | null {
  for (let i = room.trades.length - 1; i >= 0; i--) {
    if (room.trades[i].foodType === food) return room.trades[i].pricePerUnit;
  }
  return null;
}

function bestAskPrice(room: GameRoom, food: FoodType): number | null {
  const asks = room.orderBooks[food].asks;
  return asks.length > 0 ? asks[0].pricePerUnit : null;
}

function bestBidPrice(room: GameRoom, food: FoodType): number | null {
  const bids = room.orderBooks[food].bids;
  return bids.length > 0 ? bids[0].pricePerUnit : null;
}

function tryPostOrder(
  room: GameRoom,
  bot: Player,
  side: "bid" | "ask",
  food: FoodType,
  quantity: number,
  pricePerUnit: number,
): Trade[] {
  if (quantity < 1) return [];
  if (pricePerUnit < 0) return [];
  try {
    const result = postOrder(room, {
      playerId: bot.id,
      side,
      foodType: food,
      quantity,
      pricePerUnit,
    });
    return result.trades;
  } catch (err) {
    if (err instanceof OrderValidationError) return [];
    throw err;
  }
}

interface BotActionResult {
  trades: Trade[];
}

export function runBotActions(room: GameRoom, bot: Player): BotActionResult {
  const allTrades: Trade[] = [];
  if (room.phase !== "active") return { trades: allTrades };
  if (bot.status !== "alive") return { trades: allTrades };

  const avail = availableInventory(bot.inventory, bot.reservedInventory);
  const cash = bot.cash - bot.reservedCash;
  const required = requiredFoods(bot.produces);

  for (const f of required) {
    const survival = avail[f];
    let price = 0;
    let qty = 0;

    if (survival <= 2) {
      const ask = bestAskPrice(room, f);
      const reference = ask ?? lastTradePriceFor(room, f) ?? 15;
      price = Math.max(reference, 12);
      qty = Math.min(5, Math.floor(cash / Math.max(1, price)));
    } else if (survival <= 6) {
      const ask = bestAskPrice(room, f);
      const ref = ask ?? lastTradePriceFor(room, f) ?? 8;
      price = Math.max(6, Math.min(ref + 1, 14));
      qty = Math.min(3, Math.floor(cash / Math.max(1, price)));
    } else if (survival <= 20) {
      const ask = bestAskPrice(room, f);
      const last = lastTradePriceFor(room, f);
      const ref = ask ?? last ?? 5;
      price = Math.max(3, Math.min(ref, 8));
      qty = Math.min(2, Math.floor(cash / Math.max(1, price)));
    } else {
      const last = lastTradePriceFor(room, f) ?? 4;
      price = Math.max(2, Math.min(last - 1, 5));
      qty = 1;
      if (Math.random() > 0.5) continue;
    }

    if (qty >= 1 && price >= 1 && qty * price <= cash) {
      const trades = tryPostOrder(room, bot, "bid", f, qty, price);
      allTrades.push(...trades);
    }
  }

  if (bot.produces) {
    const own = bot.produces;
    const ownAvail = avail[own];
    if (ownAvail >= 5) {
      const bid = bestBidPrice(room, own);
      const last = lastTradePriceFor(room, own);
      const reference = bid ?? last ?? 5;
      const price = Math.max(3, reference + 1 + Math.floor(Math.random() * 2));
      const sellQty = Math.min(5, Math.max(2, Math.floor(ownAvail / 3)));
      const trades = tryPostOrder(room, bot, "ask", own, sellQty, price);
      allTrades.push(...trades);
    }
  }

  return { trades: allTrades };
}

export function startBotLoop(
  room: GameRoom,
  bot: Player,
  onAction: (room: GameRoom, bot: Player, trades: Trade[]) => void,
): void {
  if (room.botIntervals.has(bot.id)) return;
  const cadence = 1500 + Math.floor(Math.random() * 1000);
  const initialDelay = 500 + Math.floor(Math.random() * 1500);

  const tick = () => {
    if (room.phase !== "active") return;
    if (bot.status !== "alive") {
      const handle = room.botIntervals.get(bot.id);
      if (handle) clearInterval(handle);
      room.botIntervals.delete(bot.id);
      return;
    }
    try {
      const result = runBotActions(room, bot);
      if (result.trades.length > 0) onAction(room, bot, result.trades);
    } catch (err) {
      console.error("[bot] error in", bot.name, err);
    }
  };

  setTimeout(() => {
    tick();
    const handle = setInterval(tick, cadence);
    room.botIntervals.set(bot.id, handle);
  }, initialDelay);
}

export function stopAllBotLoops(room: GameRoom): void {
  for (const handle of room.botIntervals.values()) clearInterval(handle);
  room.botIntervals.clear();
}

export const _FOODS = FOOD_TYPES;
