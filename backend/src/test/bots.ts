import { io as ioClient, Socket } from "socket.io-client";
import http from "http";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import { attachSocketHandlers } from "../socket";

interface Client {
  socket: Socket;
  name: string;
  playerId?: string;
  publicState?: any;
  privateState?: any;
  ownOrders?: any[];
  orderBooks?: any;
  errors: any[];
  trades: any[];
  gameOver?: any;
  roomCode?: string;
}

function makeClient(url: string, name: string): Client {
  const sock = ioClient(url, { transports: ["websocket"], forceNew: true });
  const c: Client = { socket: sock, name, errors: [], trades: [] };
  sock.on("room_joined", (p) => {
    c.playerId = p.playerId;
    c.roomCode = p.roomCode;
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
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
async function waitFor(check: () => boolean, t = 8000, i = 50) {
  const t0 = Date.now();
  while (Date.now() - t0 < t) {
    if (check()) return;
    await wait(i);
  }
  throw new Error("waitFor timed out");
}
function assertEq(a: any, b: any, msg: string) {
  if (a !== b) throw new Error(`ASSERT ${msg}: ${a} !== ${b}`);
}

async function main() {
  const PORT = 3505;
  const app = express();
  app.use(cors({ origin: "*" }));
  const server = http.createServer(app);
  const ioServer = new Server(server, { cors: { origin: "*" } });
  attachSocketHandlers(ioServer);
  await new Promise<void>((res) => server.listen(PORT, () => res()));
  console.log("[bots] server up on", PORT);

  const url = `http://localhost:${PORT}`;
  const human = makeClient(url, "Human");
  await waitFor(() => human.socket.connected);

  human.socket.emit("create_room", { playerName: "Human" });
  await waitFor(() => !!human.roomCode);
  const roomCode = human.roomCode!;
  console.log("[bots] room", roomCode);

  // Try fill_with_bots equivalent: emit add_bot 3 times
  human.socket.emit("add_bot", { roomCode, playerId: human.playerId });
  human.socket.emit("add_bot", { roomCode, playerId: human.playerId });
  human.socket.emit("add_bot", { roomCode, playerId: human.playerId });
  await waitFor(() => (human.publicState?.players?.length ?? 0) === 4);
  console.log(
    "[bots] lobby filled:",
    human.publicState.players.map((p: any) => `${p.name}${p.isBot ? "[bot]" : ""}`),
  );

  const bots = human.publicState.players.filter((p: any) => p.isBot);
  assertEq(bots.length, 3, "3 bots in lobby");

  // Test that non-host cannot add bot — skip (only one human here)
  // Test remove_bot works
  human.socket.emit("remove_bot", {
    roomCode,
    playerId: human.playerId,
    botId: bots[0].id,
  });
  await waitFor(
    () => (human.publicState?.players?.length ?? 0) === 3,
  );
  console.log("[bots] remove_bot worked, count=3");
  human.socket.emit("add_bot", { roomCode, playerId: human.playerId });
  await waitFor(() => (human.publicState?.players?.length ?? 0) === 4);

  human.socket.emit("start_game", { roomCode, playerId: human.playerId });
  await waitFor(() => human.publicState?.phase === "active");
  await waitFor(() => !!human.privateState?.produces);
  console.log("[bots] game started, human produces", human.privateState.produces);

  // Wait ~6 seconds for bots to start trading
  console.log("[bots] watching bot trading for 6 seconds…");
  await wait(6000);

  console.log("[bots] human saw", human.trades.length, "trades");
  if (human.trades.length === 0) {
    throw new Error("expected bots to trade with each other within 6s");
  }

  // Bots should bid for required foods. Human posts a high ask on a bot's required food
  // and the bot should buy it eventually if its inventory is low.
  // Just verify trades involving bots happened.
  const tradeWithBot = human.trades.some(
    (t: any) => bots.some((b: any) => b.id === t.buyerId || b.id === t.sellerId),
  );
  if (!tradeWithBot) {
    throw new Error("expected at least one trade involving a bot");
  }
  console.log("[bots] bots are trading with each other ✓");

  // Verify bots haven't all died yet (game should still be active)
  const aliveCount = human.publicState.players.filter((p: any) => p.status === "alive").length;
  console.log("[bots] alive:", aliveCount, "/ 4");
  if (aliveCount < 2) {
    throw new Error(`bots dying too fast: only ${aliveCount} alive after 6s`);
  }

  console.log("[bots] PASSED");
  human.socket.disconnect();
  ioServer.close();
  server.close();
  setTimeout(() => process.exit(0), 200);
}

main().catch((err) => {
  console.error("[bots] FAILED:", err);
  process.exit(1);
});
