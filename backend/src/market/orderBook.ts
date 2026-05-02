import type { Order, OrderBook } from "../types";

export function sortBids(bids: Order[]): void {
  bids.sort((a, b) => {
    if (b.pricePerUnit !== a.pricePerUnit) {
      return b.pricePerUnit - a.pricePerUnit;
    }
    return a.createdAt - b.createdAt;
  });
}

export function sortAsks(asks: Order[]): void {
  asks.sort((a, b) => {
    if (a.pricePerUnit !== b.pricePerUnit) {
      return a.pricePerUnit - b.pricePerUnit;
    }
    return a.createdAt - b.createdAt;
  });
}

export function addOrderToBook(book: OrderBook, order: Order): void {
  if (order.side === "bid") {
    book.bids.push(order);
    sortBids(book.bids);
  } else {
    book.asks.push(order);
    sortAsks(book.asks);
  }
}

export function removeOrderFromBook(book: OrderBook, orderId: string): Order | undefined {
  const bidIdx = book.bids.findIndex((o) => o.id === orderId);
  if (bidIdx >= 0) {
    const [removed] = book.bids.splice(bidIdx, 1);
    return removed;
  }
  const askIdx = book.asks.findIndex((o) => o.id === orderId);
  if (askIdx >= 0) {
    const [removed] = book.asks.splice(askIdx, 1);
    return removed;
  }
  return undefined;
}

export function findOrderInBook(book: OrderBook, orderId: string): Order | undefined {
  return (
    book.bids.find((o) => o.id === orderId) ??
    book.asks.find((o) => o.id === orderId)
  );
}
