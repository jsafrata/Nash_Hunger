import { io as ioClient, Socket } from "socket.io-client";

interface Client {
  socket: Socket;
  name: string;
  playerId?: string;
  publicState?: any;
  privateState?: any;
  errors: any[];
  gameOver?: any;
  trades: any[];
}

function makeClient(url: string, name: string): Client {
  const sock = ioClient(url, { transports: ["websocket"], forceNew: true });
  const c: Client = { socket: sock, name, errors: [], trades: [] };
  sock.on("room_joined", (p) => (c.playerId = p.playerId));
  sock.on("room_update", (p) => (c.publicState = p));
  sock.on("private_update", (p) => (c.privateState = p));
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

async function main() {
  const URL = "http://localhost:3401";
  await fetch(`${URL}/health`);

  const a = makeClient(URL, "A");
  const b = makeClient(URL, "B");
  const c = makeClient(URL, "C");
  const d = makeClient(URL, "D");
  await waitFor(() => [a, b, c, d].every((x) => x.socket.connected));

  let roomCode = "";
  a.socket.once("room_joined", (p) => (roomCode = p.roomCode));
  a.socket.emit("create_room", { playerName: "A" });
  await waitFor(() => !!roomCode);
  b.socket.emit("join_room", { roomCode, playerName: "B" });
  c.socket.emit("join_room", { roomCode, playerName: "C" });
  d.socket.emit("join_room", { roomCode, playerName: "D" });
  await waitFor(() => [a, b, c, d].every((x) => !!x.playerId));
  a.socket.emit("start_game", { roomCode, playerId: a.playerId });
  await waitFor(() => a.publicState?.phase === "active");
  await waitFor(() => [a, b, c, d].every((x) => !!x.privateState?.produces));
  console.log("[starvation] game started");

  // Make all 4 players reserve all of every required food via huge asks at insane prices.
  // They should die at next consumption tick because reserved food is unavailable.
  for (const cl of [a, b, c, d]) {
    const req = cl.privateState.requiredFoods as ("A" | "B" | "C" | "D")[];
    for (const f of req) {
      const qty = cl.privateState.inventory[f];
      if (qty > 0) {
        cl.socket.emit("post_order", {
          roomCode,
          playerId: cl.playerId,
          side: "ask",
          foodType: f,
          quantity: qty,
          pricePerUnit: 99999,
        });
      }
    }
  }
  console.log("[starvation] all players reserved everything");

  // Wait up to ~3 seconds for everyone to die / game_over to fire
  await waitFor(
    () => !!a.gameOver,
    8000,
    100,
  );
  console.log("[starvation] game over fired:", a.gameOver.reason);

  // Assert ended state
  const dead = a.gameOver.finalPlayers.filter((p: any) => p.status === "dead").length;
  console.log("[starvation] final dead:", dead);
  if (dead < 3) throw new Error(`expected ≥3 dead, got ${dead}`);
  // reason should be no_survivors or single_survivor
  if (!["no_survivors", "single_survivor"].includes(a.gameOver.reason)) {
    throw new Error(`unexpected end reason: ${a.gameOver.reason}`);
  }

  console.log("[starvation] PASSED");
  for (const cl of [a, b, c, d]) cl.socket.disconnect();
  setTimeout(() => process.exit(0), 200);
}

main().catch((err) => {
  console.error("[starvation] FAILED:", err);
  process.exit(1);
});
