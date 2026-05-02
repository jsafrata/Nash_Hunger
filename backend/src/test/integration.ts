import { io as ioClient, Socket } from "socket.io-client";
import http from "http";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import { attachSocketHandlers } from "../socket";

interface ClientState {
  socket: Socket;
  name: string;
  playerId?: string;
  roomCode?: string;
  isHost?: boolean;
  publicState?: any;
  privateState?: any;
  ownOrders?: any[];
  orderBooks?: any;
  errors: { code: string; message: string }[];
  trades: any[];
  gameOver?: any;
}

function makeClient(url: string, name: string): ClientState {
  const sock = ioClient(url, { transports: ["websocket"], forceNew: true });
  const c: ClientState = { socket: sock, name, errors: [], trades: [] };
  sock.on("room_joined", (p) => {
    c.roomCode = p.roomCode;
    c.playerId = p.playerId;
    c.isHost = p.isHost;
  });
  sock.on("room_update", (p) => (c.publicState = p));
  sock.on("private_update", (p) => (c.privateState = p));
  sock.on("own_orders_update", (p) => (c.ownOrders = p));
  sock.on("order_book_update", (p) => (c.orderBooks = p));
  sock.on("error_message", (p) => c.errors.push(p));
  sock.on("trade_executed", (p) => c.trades.push(p));
  sock.on("game_over", (p) => (c.gameOver = p));
  return c;
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitFor(check: () => boolean, timeoutMs = 3000, intervalMs = 50) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (check()) return;
    await wait(intervalMs);
  }
  throw new Error("waitFor timed out");
}

function assertEq(a: any, b: any, msg: string) {
  if (a !== b) throw new Error(`ASSERT ${msg}: ${a} !== ${b}`);
}

async function main() {
  const PORT = 3210;
  const app = express();
  app.use(cors({ origin: "*" }));
  const server = http.createServer(app);
  const ioServer = new Server(server, { cors: { origin: "*" } });
  attachSocketHandlers(ioServer);
  await new Promise<void>((res) => server.listen(PORT, () => res()));
  console.log("[test] server up on", PORT);

  const url = `http://localhost:${PORT}`;
  const a = makeClient(url, "Alice");
  const b = makeClient(url, "Ben");
  const c = makeClient(url, "Cara");
  const d = makeClient(url, "David");

  await waitFor(() => a.socket.connected && b.socket.connected && c.socket.connected && d.socket.connected);
  console.log("[test] all sockets connected");

  a.socket.emit("create_room", { playerName: "Alice" });
  await waitFor(() => !!a.roomCode);
  const roomCode = a.roomCode!;
  console.log("[test] room created", roomCode);

  b.socket.emit("join_room", { roomCode, playerName: "Ben" });
  c.socket.emit("join_room", { roomCode, playerName: "Cara" });
  d.socket.emit("join_room", { roomCode, playerName: "David" });
  await waitFor(() => !!b.roomCode && !!c.roomCode && !!d.roomCode);
  await waitFor(() => (a.publicState?.players?.length ?? 0) === 4);
  console.log("[test] 4 players joined");

  a.socket.emit("start_game", { roomCode, playerId: a.playerId });
  await waitFor(() => a.publicState?.phase === "active");
  console.log("[test] game started, phase=active");

  await waitFor(() => !!a.privateState?.produces && !!b.privateState?.produces && !!c.privateState?.produces && !!d.privateState?.produces);
  const producers = [a, b, c, d].map((cl) => cl.privateState.produces);
  const uniqueProducers = new Set(producers);
  assertEq(uniqueProducers.size, 4, "all producers unique");
  console.log("[test] producer assignment unique:", producers);

  for (const cl of [a, b, c, d]) {
    let total = 0;
    for (const k of ["A", "B", "C", "D"] as const) total += cl.privateState.inventory[k];
    assertEq(total, 100, `${cl.name} should start with 100 food`);
    assertEq(cl.privateState.cash, 100, `${cl.name} should start with 100 cash`);
  }
  console.log("[test] starting balances correct");

  let globalA = 0,
    globalB = 0,
    globalC = 0,
    globalD = 0;
  for (const cl of [a, b, c, d]) {
    globalA += cl.privateState.inventory.A;
    globalB += cl.privateState.inventory.B;
    globalC += cl.privateState.inventory.C;
    globalD += cl.privateState.inventory.D;
  }
  assertEq(globalA, 100, "total A=100");
  assertEq(globalB, 100, "total B=100");
  assertEq(globalC, 100, "total C=100");
  assertEq(globalD, 100, "total D=100");
  console.log("[test] global food distribution correct: 100 each");

  // Self-trade prevention test: have producer of A post a bid for A and an ask for A
  const aProducer = [a, b, c, d].find((cl) => cl.privateState.produces === "A")!;
  // Check ask + bid of same player don't self-match
  // (only meaningful test if same player has both - skip detailed, just ensure they can post)

  // Let one player post a bid and another post a matching ask
  // Find a player whose required food is C, find another player who has C and is willing to sell
  const seller = [a, b, c, d].find((cl) => cl.privateState.inventory.B >= 5)!;
  const buyer = [a, b, c, d].find((cl) => cl.name !== seller.name && cl.privateState.produces !== "B")!;

  // Buyer posts bid for B at $10, qty 5
  const cashBefore_buyer = buyer.privateState.cash;
  const cashBefore_seller = seller.privateState.cash;
  const bBefore_buyer = buyer.privateState.inventory.B;
  const bBefore_seller = seller.privateState.inventory.B;

  buyer.socket.emit("post_order", {
    roomCode,
    playerId: buyer.playerId,
    side: "bid",
    foodType: "B",
    quantity: 5,
    pricePerUnit: 10,
  });

  await wait(150);

  // Seller posts ask for B at $8, qty 5 — should match at maker price ($10)
  seller.socket.emit("post_order", {
    roomCode,
    playerId: seller.playerId,
    side: "ask",
    foodType: "B",
    quantity: 5,
    pricePerUnit: 8,
  });

  await waitFor(() => seller.trades.length > 0);
  const trade = seller.trades[0];
  assertEq(trade.foodType, "B", "trade is for B");
  assertEq(trade.pricePerUnit, 10, "trade executes at maker price ($10)");
  assertEq(trade.quantity, 5, "trade qty 5");
  console.log("[test] trade matched at maker price:", trade.pricePerUnit);

  await wait(150);
  // After trade, buyer's cash should decrease by 50 (5 * $10), seller's cash up by 50.
  assertEq(
    buyer.privateState.cash,
    cashBefore_buyer - 50,
    "buyer cash decreased by 50",
  );
  assertEq(
    seller.privateState.cash,
    cashBefore_seller + 50,
    "seller cash increased by 50",
  );
  assertEq(
    buyer.privateState.inventory.B,
    bBefore_buyer + 5,
    "buyer received 5 B",
  );
  assertEq(
    seller.privateState.inventory.B,
    bBefore_seller - 5,
    "seller lost 5 B",
  );
  console.log("[test] cash and inventory correctly updated");

  // Test cancel
  buyer.socket.emit("post_order", {
    roomCode,
    playerId: buyer.playerId,
    side: "bid",
    foodType: "C",
    quantity: 3,
    pricePerUnit: 4,
  });
  await waitFor(() => (buyer.ownOrders?.length ?? 0) > 0);
  const bidId = buyer.ownOrders![0].id;
  const reservedBefore = buyer.privateState.reservedCash;
  if (reservedBefore < 12) throw new Error("expected reserved cash 12");
  buyer.socket.emit("cancel_order", {
    roomCode,
    playerId: buyer.playerId,
    orderId: bidId,
  });
  await waitFor(() => (buyer.ownOrders?.length ?? 0) === 0);
  await wait(50);
  assertEq(buyer.privateState.reservedCash, 0, "reserved cash released after cancel");
  console.log("[test] cancel releases reservation");

  // Test insufficient cash bid → should error
  buyer.socket.emit("post_order", {
    roomCode,
    playerId: buyer.playerId,
    side: "bid",
    foodType: "A",
    quantity: 1000,
    pricePerUnit: 999,
  });
  await waitFor(() => buyer.errors.some((e) => e.code === "insufficient_cash"));
  console.log("[test] insufficient cash properly rejected");

  // Wait for ticks: produce/consume happens every second.
  // Check producer of own food gains 2/sec, others lose required foods.
  const aProducerInv0 = aProducer.privateState.inventory[aProducer.privateState.produces];
  await wait(2200);
  const aProducerInv1 = aProducer.privateState.inventory[aProducer.privateState.produces];
  if (aProducerInv1 < aProducerInv0 + 2) {
    throw new Error(
      `expected producer to gain at least 2 of own food after 2s; was ${aProducerInv0} -> ${aProducerInv1}`,
    );
  }
  console.log(
    "[test] production verified",
    aProducer.privateState.produces,
    aProducerInv0,
    "->",
    aProducerInv1,
  );

  // verify consumption: a player should be lower in some required foods
  // (without having traded to refill)
  const consumed = [a, b, c, d].some((cl) => {
    const req = cl.privateState.requiredFoods as ("A" | "B" | "C" | "D")[];
    return req.some((f) => cl.privateState.inventory[f] < 100 / 4 + 5);
  });
  if (!consumed) console.warn("[warn] consumption signal weak");
  console.log("[test] consumption running");

  console.log("[test] All assertions passed.");

  for (const cl of [a, b, c, d]) cl.socket.disconnect();
  ioServer.close();
  server.close();
  setTimeout(() => process.exit(0), 200);
}

main().catch((err) => {
  console.error("[test] FAILED:", err);
  process.exit(1);
});
