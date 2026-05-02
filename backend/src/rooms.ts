import { GAME_CONFIG } from "./config";
import { createEmptyOrderBooks } from "./game/setup";
import type { GameRoom, Player } from "./types";
import { generateRoomCode } from "./utils/roomCode";
import { emptyInventory } from "./utils/inventory";
import { createPlayerId } from "./utils/ids";

const rooms = new Map<string, GameRoom>();

export function getRoom(code: string): GameRoom | undefined {
  return rooms.get(code);
}

export function deleteRoom(code: string): void {
  const room = rooms.get(code);
  if (room?.tickInterval) clearInterval(room.tickInterval);
  if (room?.botIntervals) {
    for (const t of room.botIntervals.values()) clearInterval(t);
    room.botIntervals.clear();
  }
  rooms.delete(code);
}

export function createRoom(): GameRoom {
  let code = generateRoomCode();
  while (rooms.has(code)) code = generateRoomCode();

  const room: GameRoom = {
    roomCode: code,
    phase: "lobby",
    players: [],
    orderBooks: createEmptyOrderBooks(),
    trades: [],
    eventLog: [],
    startedAt: null,
    endsAt: null,
    elapsedSeconds: 0,
    maxSeconds: GAME_CONFIG.GAME_DURATION_SECONDS,
    tickInterval: null,
    botIntervals: new Map(),
    rateLimits: new Map(),
    winnerIds: [],
    endReason: null,
  };
  rooms.set(code, room);
  return room;
}

export function newPlayer(
  name: string,
  isHost: boolean,
  options: { isBot?: boolean } = {},
): Player {
  return {
    id: createPlayerId(),
    socketId: null,
    name: name.slice(0, 20) || "Player",
    isHost,
    isBot: !!options.isBot,
    status: "alive",
    produces: null,
    cash: 0,
    reservedCash: 0,
    inventory: emptyInventory(),
    reservedInventory: emptyInventory(),
    diedAtSecond: null,
    disconnectedAtSecond: null,
    totalBought: 0,
    totalSold: 0,
    cashFromTrades: 0,
    cashSpentOnTrades: 0,
  };
}

export function addPlayerToRoom(room: GameRoom, player: Player): void {
  if (room.phase !== "lobby") {
    throw new Error("Cannot join: game already started");
  }
  if (room.players.length >= GAME_CONFIG.PLAYER_COUNT) {
    throw new Error("Room is full");
  }
  room.players.push(player);
}

export function removePlayerFromLobby(
  room: GameRoom,
  playerId: string,
): void {
  room.players = room.players.filter((p) => p.id !== playerId);
  if (room.players.length === 0) {
    deleteRoom(room.roomCode);
    return;
  }
  if (!room.players.some((p) => p.isHost)) {
    room.players[0].isHost = true;
  }
}

export function findPlayerById(
  room: GameRoom,
  playerId: string,
): Player | undefined {
  return room.players.find((p) => p.id === playerId);
}

export function findPlayerBySocketId(
  room: GameRoom,
  socketId: string,
): Player | undefined {
  return room.players.find((p) => p.socketId === socketId);
}

export function findRoomBySocketId(
  socketId: string,
): { room: GameRoom; player: Player } | undefined {
  for (const room of rooms.values()) {
    const player = room.players.find((p) => p.socketId === socketId);
    if (player) return { room, player };
  }
  return undefined;
}

export function listRooms(): GameRoom[] {
  return Array.from(rooms.values());
}
