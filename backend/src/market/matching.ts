import type { GameRoom, Order, Trade, FoodType } from "../types";
import { GAME_CONFIG } from "../config";
import { findPlayerById } from "../rooms";
import { applyTradeReservations } from "./reservations";
import { addOrderToBook, removeOrderFromBook, sortAsks, sortBids } from "./orderBook";
import { createTradeId } from "../utils/ids";

interface ExecuteTradeArgs {
  room: GameRoom;
  buyerOrder: Order;
  sellerOrder: Order;
  makerOrder: Order;
  takerOrder: Order;
  quantity: number;
  foodType: FoodType;
}

function executeTrade(args: ExecuteTradeArgs): Trade {
  const { room, buyerOrder, sellerOrder, makerOrder, takerOrder, quantity, foodType } = args;

  const buyer = findPlayerById(room, buyerOrder.playerId);
  const seller = findPlayerById(room, sellerOrder.playerId);
  if (!buyer || !seller) throw new Error("Trade participant missing");

  const tradePrice = makerOrder.pricePerUnit;
  const totalPrice = tradePrice * quantity;

  buyer.cash -= totalPrice;
  seller.cash += totalPrice;

  seller.inventory[foodType] -= quantity;
  buyer.inventory[foodType] += quantity;

  buyerOrder.remainingQuantity -= quantity;
  sellerOrder.remainingQuantity -= quantity;
  buyerOrder.updatedAt = Date.now();
  sellerOrder.updatedAt = Date.now();

  applyTradeReservations({
    buyer,
    seller,
    buyerOrder,
    sellerOrder,
    quantity,
    tradePrice,
  });

  buyer.totalBought += quantity;
  buyer.cashSpentOnTrades += totalPrice;
  seller.totalSold += quantity;
  seller.cashFromTrades += totalPrice;

  buyerOrder.status = buyerOrder.remainingQuantity === 0 ? "filled" : "partially_filled";
  sellerOrder.status = sellerOrder.remainingQuantity === 0 ? "filled" : "partially_filled";

  const trade: Trade = {
    id: createTradeId(),
    foodType,
    buyerId: buyer.id,
    sellerId: seller.id,
    pricePerUnit: tradePrice,
    quantity,
    totalPrice,
    makerOrderId: makerOrder.id,
    takerOrderId: takerOrder.id,
    timestamp: Date.now(),
    elapsedSecond: room.elapsedSeconds,
  };
  room.trades.push(trade);
  if (room.trades.length > GAME_CONFIG.RECENT_TRADES_LIMIT * 4) {
    room.trades.splice(0, room.trades.length - GAME_CONFIG.RECENT_TRADES_LIMIT * 4);
  }

  return trade;
}

export function matchIncomingOrder(room: GameRoom, incoming: Order): Trade[] {
  const book = room.orderBooks[incoming.foodType];
  const trades: Trade[] = [];

  if (incoming.side === "bid") {
    while (incoming.remainingQuantity > 0) {
      sortAsks(book.asks);
      const ask = book.asks.find((o) => o.playerId !== incoming.playerId);
      if (!ask) break;
      if (incoming.pricePerUnit < ask.pricePerUnit) break;

      const qty = Math.min(incoming.remainingQuantity, ask.remainingQuantity);
      trades.push(
        executeTrade({
          room,
          buyerOrder: incoming,
          sellerOrder: ask,
          makerOrder: ask,
          takerOrder: incoming,
          quantity: qty,
          foodType: incoming.foodType,
        }),
      );

      if (ask.remainingQuantity === 0) {
        removeOrderFromBook(book, ask.id);
      }
    }
  } else {
    while (incoming.remainingQuantity > 0) {
      sortBids(book.bids);
      const bid = book.bids.find((o) => o.playerId !== incoming.playerId);
      if (!bid) break;
      if (bid.pricePerUnit < incoming.pricePerUnit) break;

      const qty = Math.min(incoming.remainingQuantity, bid.remainingQuantity);
      trades.push(
        executeTrade({
          room,
          buyerOrder: bid,
          sellerOrder: incoming,
          makerOrder: bid,
          takerOrder: incoming,
          quantity: qty,
          foodType: incoming.foodType,
        }),
      );

      if (bid.remainingQuantity === 0) {
        removeOrderFromBook(book, bid.id);
      }
    }
  }

  if (incoming.remainingQuantity > 0) {
    addOrderToBook(book, incoming);
  } else {
    incoming.status = "filled";
  }

  return trades;
}
