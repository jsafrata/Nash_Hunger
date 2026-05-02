import type { Order, Player } from "../types";

export function reserveForOrder(player: Player, order: Order): void {
  if (order.side === "bid") {
    player.reservedCash += order.pricePerUnit * order.remainingQuantity;
  } else {
    player.reservedInventory[order.foodType] += order.remainingQuantity;
  }
}

export function releaseRemainingReservation(
  player: Player,
  order: Order,
): void {
  if (order.remainingQuantity <= 0) return;
  if (order.side === "bid") {
    const refund = order.pricePerUnit * order.remainingQuantity;
    player.reservedCash = Math.max(0, player.reservedCash - refund);
  } else {
    player.reservedInventory[order.foodType] = Math.max(
      0,
      player.reservedInventory[order.foodType] - order.remainingQuantity,
    );
  }
}

export function applyTradeReservations(args: {
  buyer: Player;
  seller: Player;
  buyerOrder: Order;
  sellerOrder: Order;
  quantity: number;
  tradePrice: number;
}): void {
  const { buyer, seller, buyerOrder, sellerOrder, quantity, tradePrice } = args;

  const reservedAtLimit = buyerOrder.pricePerUnit * quantity;
  buyer.reservedCash = Math.max(0, buyer.reservedCash - reservedAtLimit);

  seller.reservedInventory[sellerOrder.foodType] = Math.max(
    0,
    seller.reservedInventory[sellerOrder.foodType] - quantity,
  );

  void tradePrice;
}
