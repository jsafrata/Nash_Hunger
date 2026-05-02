import { io as ioClient, Socket } from "socket.io-client";

interface Client {
  socket: Socket;
  name: string;
  playerId?: string;
  publicState?: any;
  privateState?: any;
  ownOrders?: any[];
  orderBooks?: any;
  errors: { code: string; message: string }[];
  trades: any[];
  gameOver?: any;
}

function makeClient(url: string, name: string): Client {
  const sock = ioClient(url, { transports: ["websocket"], forceNew: true });
  const c: Client = { socket: sock, name, errors: [], trades: [] };
  sock.on("room_joined", (p) => (c.playerId = p.playerId));
  sock.on("room_update", (p) => (c.publicState = p));
  sock.on("private_update", (p) => (c.privateState = p));
  sock.on("own_orders_update", (p) => (c.ownOrders = p));
  sock.on("order_book_update", (p) => (c.orderBooks = p));
  sock.on("error_message", (p) => c.errors.push(p));
  sock.on("trade_executed", (p) => c.trades.push(p));
  sock.on("game_over", (p) => (c.gameOver = p));
  return c;
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
async function waitFor(check: () => boolean, timeoutMs = 5000, interval = 50) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (check()) return;
    await wait(interval);
  }
  throw new Error("waitFor timed out");
}
function assertEq(a: any, b: any, msg: string) {
  if (a !== b) throw new Error(`ASSERT ${msg}: ${a} !== ${b}`);
}

async function main() {
  const URL = "http://localhost:3401";

  // Sanity: backend reachable
  await fetch(`${URL}/health`).then((r) => {
    if (!r.ok) throw new Error("backend /health not ok");
  });

  const a = makeClient(URL, "Alice");
  const b = makeClient(URL, "Ben");
  const c = makeClient(URL, "Cara");
  const d = makeClient(URL, "David");

  await waitFor(() => [a, b, c, d].every((x) => x.socket.connected));

  let roomCode = "";
  a.socket.once("room_joined", (p) => (roomCode = p.roomCode));
  a.socket.emit("create_room", { playerName: "Alice" });
  await waitFor(() => !!roomCode);

  b.socket.emit("join_room", { roomCode, playerName: "Ben" });
  c.socket.emit("join_room", { roomCode, playerName: "Cara" });
  d.socket.emit("join_room", { roomCode, playerName: "David" });
  await waitFor(() => [a, b, c, d].every((x) => !!x.playerId));
  await waitFor(() => (a.publicState?.players?.length ?? 0) === 4);

  a.socket.emit("start_game", { roomCode, playerId: a.playerId });
  await waitFor(() => a.publicState?.phase === "active");
  await waitFor(() =>
    [a, b, c, d].every((x) => !!x.privateState?.produces),
  );
  console.log("[scenario] game started");

  // Test reservation prevents consumption: post a huge ask using all of a required food
  // Find someone whose required food they have ≥5 of. Reserve all of it via ask.
  const target = [a, b, c, d].find((x) => {
    const req = x.privateState.requiredFoods as ("A" | "B" | "C" | "D")[];
    return req.some((f) => x.privateState.inventory[f] >= 5);
  })!;
  const lockFood = (target.privateState.requiredFoods as any[]).find(
    (f: any) => target.privateState.inventory[f] >= 5,
  );
  console.log(
    `[scenario] ${target.name} will reserve all ${lockFood} (qty ${target.privateState.inventory[lockFood]}) via an ask`,
  );

  const reserveQty = target.privateState.inventory[lockFood];
  target.socket.emit("post_order", {
    roomCode,
    playerId: target.playerId,
    side: "ask",
    foodType: lockFood,
    quantity: reserveQty,
    pricePerUnit: 9999, // unlikely to fill
  });
  await wait(200);

  // Verify availableInventory[lockFood] is 0
  if (target.privateState.availableInventory[lockFood] !== 0) {
    throw new Error(
      `expected availableInventory[${lockFood}] = 0 after reserving all, got ${target.privateState.availableInventory[lockFood]}`,
    );
  }
  console.log("[scenario] reservation locks inventory correctly");

  // Self-trade prevention: target posts a bid on the same food they reserved
  // Their own ask should not fill against their own bid.
  const bidsBefore = target.trades.length;
  target.socket.emit("post_order", {
    roomCode,
    playerId: target.playerId,
    side: "bid",
    foodType: lockFood,
    quantity: 1,
    pricePerUnit: 9999,
  });
  await wait(200);
  if (target.trades.length !== bidsBefore) {
    throw new Error("self-trade fired (bug): own bid matched own ask");
  }
  console.log("[scenario] self-trade prevented");

  // Cancel both
  target.socket.emit("cancel_all_orders", {
    roomCode,
    playerId: target.playerId,
  });
  await wait(200);
  if (target.privateState.reservedCash !== 0) {
    throw new Error("reservedCash not released after cancel_all");
  }
  if (target.privateState.reservedInventory[lockFood] !== 0) {
    throw new Error(
      `reservedInventory[${lockFood}] not released after cancel_all`,
    );
  }
  console.log("[scenario] cancel_all releases all reservations");

  // Game-over flow: skip — would require waiting 180s. Instead disconnect 3 clients
  // — the remaining one becomes single survivor after grace timeout (15s). Skip for speed.

  console.log("[scenario] All scenario assertions passed.");
  for (const cl of [a, b, c, d]) cl.socket.disconnect();
  setTimeout(() => process.exit(0), 200);
}

main().catch((err) => {
  console.error("[scenario] FAILED:", err);
  process.exit(1);
});
