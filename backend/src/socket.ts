import type { Server, Socket } from "socket.io";
import {
  addPlayerToRoom,
  createRoom,
  findPlayerById,
  findRoomBySocketId,
  getRoom,
  newPlayer,
  removePlayerFromLobby,
} from "./rooms";
import { GAME_CONFIG } from "./config";
import { startGame } from "./game/setup";
import { buildGameOverPayload, gameTick, startTickLoop } from "./game/tick";
import {
  buildAllPublicOrderBooks,
  buildPublicGameState,
} from "./visibility/publicState";
import {
  buildOwnOrders,
  buildPrivatePlayerState,
} from "./visibility/privateState";
import {
  cancelAllOrdersForPlayer,
  cancelOrder,
  postOrder,
} from "./market/orderActions";
import { OrderValidationError } from "./market/validation";
import type { GameRoom, Player, Trade } from "./types";
import { createEventId } from "./utils/ids";
import { pickBotName, startBotLoop, stopAllBotLoops } from "./game/bot";

interface CreateRoomPayload {
  playerName: string;
}
interface JoinRoomPayload {
  roomCode: string;
  playerName: string;
}
interface StartGamePayload {
  roomCode: string;
  playerId: string;
}
interface PostOrderPayload {
  roomCode: string;
  playerId: string;
  side: "bid" | "ask";
  foodType: "A" | "B" | "C" | "D";
  quantity: number;
  pricePerUnit: number;
}
interface CancelOrderPayload {
  roomCode: string;
  playerId: string;
  orderId: string;
}
interface CancelAllOrdersPayload {
  roomCode: string;
  playerId: string;
}
interface ReconnectPayload {
  roomCode: string;
  playerId: string;
}
interface AddBotPayload {
  roomCode: string;
  playerId: string;
}
interface RemoveBotPayload {
  roomCode: string;
  playerId: string;
  botId: string;
}

function emitError(socket: Socket, code: string, message: string): void {
  socket.emit("error_message", { code, message });
}

function getPlayerSocket(io: Server, player: Player): Socket | undefined {
  if (!player.socketId) return undefined;
  return io.sockets.sockets.get(player.socketId);
}

function emitFullState(io: Server, room: GameRoom): void {
  const publicState = buildPublicGameState(room);
  io.to(room.roomCode).emit("room_update", publicState);

  const orderBooks = buildAllPublicOrderBooks(room);
  io.to(room.roomCode).emit("order_book_update", orderBooks);

  for (const player of room.players) {
    const sock = getPlayerSocket(io, player);
    if (!sock) continue;
    sock.emit("private_update", buildPrivatePlayerState(player));
    sock.emit("own_orders_update", buildOwnOrders(room, player.id));
  }
}

function emitGameOverIfEnded(io: Server, room: GameRoom): void {
  if (room.phase === "ended") {
    io.to(room.roomCode).emit("game_over", buildGameOverPayload(room));
  }
}

function broadcastTrades(io: Server, room: GameRoom, trades: Trade[]): void {
  for (const trade of trades) {
    io.to(room.roomCode).emit("trade_executed", {
      id: trade.id,
      foodType: trade.foodType,
      buyerId: trade.buyerId,
      sellerId: trade.sellerId,
      pricePerUnit: trade.pricePerUnit,
      quantity: trade.quantity,
      totalPrice: trade.totalPrice,
      timestamp: trade.timestamp,
    });
  }
}

function handleDisconnectGracePeriodCheck(
  io: Server,
  room: GameRoom,
): void {
  if (room.phase !== "active") return;
  const grace = GAME_CONFIG.DISCONNECT_GRACE_SECONDS;
  for (const p of room.players) {
    if (
      p.status === "disconnected" &&
      p.disconnectedAtSecond !== null &&
      room.elapsedSeconds - p.disconnectedAtSecond >= grace
    ) {
      p.status = "dead";
      p.diedAtSecond = room.elapsedSeconds;
      cancelAllOrdersForPlayer(room, p.id, { releaseReservations: false });
      p.reservedCash = 0;
      p.reservedInventory = { A: 0, B: 0, C: 0, D: 0 };
      room.eventLog.push({
        id: createEventId(),
        type: "player_died",
        elapsedSecond: room.elapsedSeconds,
        timestamp: Date.now(),
        message: `${p.name} disconnected and did not return in time.`,
        data: { playerId: p.id, reason: "disconnect_timeout" },
      });
    }
  }
}

export function attachSocketHandlers(io: Server): void {
  io.on("connection", (socket: Socket) => {
    socket.on("create_room", (payload: CreateRoomPayload) => {
      try {
        const room = createRoom();
        const player = newPlayer(payload.playerName ?? "Host", true);
        player.socketId = socket.id;
        addPlayerToRoom(room, player);
        socket.join(room.roomCode);

        socket.emit("room_joined", {
          roomCode: room.roomCode,
          playerId: player.id,
          isHost: player.isHost,
        });
        emitFullState(io, room);
      } catch (err) {
        emitError(
          socket,
          "create_failed",
          err instanceof Error ? err.message : "Failed to create room.",
        );
      }
    });

    socket.on("join_room", (payload: JoinRoomPayload) => {
      try {
        const room = getRoom(payload.roomCode?.toUpperCase());
        if (!room) {
          emitError(socket, "no_room", "Room not found.");
          return;
        }
        if (room.phase !== "lobby") {
          emitError(socket, "game_in_progress", "Game already started.");
          return;
        }
        if (room.players.length >= GAME_CONFIG.PLAYER_COUNT) {
          emitError(socket, "room_full", "Room is full.");
          return;
        }
        const player = newPlayer(payload.playerName ?? "Player", false);
        player.socketId = socket.id;
        addPlayerToRoom(room, player);
        socket.join(room.roomCode);

        socket.emit("room_joined", {
          roomCode: room.roomCode,
          playerId: player.id,
          isHost: player.isHost,
        });
        emitFullState(io, room);
      } catch (err) {
        emitError(
          socket,
          "join_failed",
          err instanceof Error ? err.message : "Failed to join room.",
        );
      }
    });

    socket.on("add_bot", (payload: AddBotPayload) => {
      try {
        const room = getRoom(payload.roomCode);
        if (!room) {
          emitError(socket, "no_room", "Room not found.");
          return;
        }
        if (room.phase !== "lobby") {
          emitError(socket, "game_in_progress", "Game already started.");
          return;
        }
        const requester = findPlayerById(room, payload.playerId);
        if (!requester || !requester.isHost) {
          emitError(socket, "not_host", "Only the host can add bots.");
          return;
        }
        if (room.players.length >= GAME_CONFIG.PLAYER_COUNT) {
          emitError(socket, "room_full", "Room is full.");
          return;
        }
        const taken = new Set(room.players.map((p) => p.name));
        const bot = newPlayer(pickBotName(taken), false, { isBot: true });
        addPlayerToRoom(room, bot);
        emitFullState(io, room);
      } catch (err) {
        emitError(
          socket,
          "add_bot_failed",
          err instanceof Error ? err.message : "Failed to add bot.",
        );
      }
    });

    socket.on("remove_bot", (payload: RemoveBotPayload) => {
      try {
        const room = getRoom(payload.roomCode);
        if (!room) {
          emitError(socket, "no_room", "Room not found.");
          return;
        }
        if (room.phase !== "lobby") {
          emitError(socket, "game_in_progress", "Cannot remove during game.");
          return;
        }
        const requester = findPlayerById(room, payload.playerId);
        if (!requester || !requester.isHost) {
          emitError(socket, "not_host", "Only the host can remove bots.");
          return;
        }
        const bot = findPlayerById(room, payload.botId);
        if (!bot || !bot.isBot) {
          emitError(socket, "no_bot", "Bot not found.");
          return;
        }
        removePlayerFromLobby(room, bot.id);
        const stillExists = getRoom(room.roomCode);
        if (stillExists) emitFullState(io, stillExists);
      } catch (err) {
        emitError(
          socket,
          "remove_bot_failed",
          err instanceof Error ? err.message : "Failed to remove bot.",
        );
      }
    });

    socket.on("start_game", (payload: StartGamePayload) => {
      try {
        const room = getRoom(payload.roomCode);
        if (!room) {
          emitError(socket, "no_room", "Room not found.");
          return;
        }
        const player = findPlayerById(room, payload.playerId);
        if (!player || !player.isHost) {
          emitError(socket, "not_host", "Only the host can start the game.");
          return;
        }
        if (room.players.length !== GAME_CONFIG.PLAYER_COUNT) {
          emitError(
            socket,
            "wrong_player_count",
            `Need exactly ${GAME_CONFIG.PLAYER_COUNT} players to start.`,
          );
          return;
        }

        startGame(room);
        room.eventLog.push({
          id: createEventId(),
          type: "game_started",
          elapsedSecond: 0,
          timestamp: Date.now(),
          message: "The game has begun.",
        });

        startTickLoop(room, (r) => {
          handleDisconnectGracePeriodCheck(io, r);
          emitFullState(io, r);
          if (r.phase === "ended") {
            stopAllBotLoops(r);
            emitGameOverIfEnded(io, r);
          }
        });

        for (const bot of room.players.filter((p) => p.isBot)) {
          startBotLoop(room, bot, (r, _b, trades) => {
            broadcastTrades(io, r, trades);
            emitFullState(io, r);
          });
        }

        emitFullState(io, room);
      } catch (err) {
        emitError(
          socket,
          "start_failed",
          err instanceof Error ? err.message : "Failed to start game.",
        );
      }
    });

    socket.on("post_order", (payload: PostOrderPayload) => {
      try {
        const room = getRoom(payload.roomCode);
        if (!room) {
          emitError(socket, "no_room", "Room not found.");
          return;
        }

        const result = postOrder(room, {
          playerId: payload.playerId,
          side: payload.side,
          foodType: payload.foodType,
          quantity: payload.quantity,
          pricePerUnit: payload.pricePerUnit,
        });

        for (const trade of result.trades) {
          io.to(room.roomCode).emit("trade_executed", {
            id: trade.id,
            foodType: trade.foodType,
            buyerId: trade.buyerId,
            sellerId: trade.sellerId,
            pricePerUnit: trade.pricePerUnit,
            quantity: trade.quantity,
            totalPrice: trade.totalPrice,
            timestamp: trade.timestamp,
          });
        }

        emitFullState(io, room);
      } catch (err) {
        if (err instanceof OrderValidationError) {
          emitError(socket, err.code, err.message);
        } else {
          emitError(
            socket,
            "post_order_failed",
            err instanceof Error ? err.message : "Failed to post order.",
          );
        }
      }
    });

    socket.on("cancel_order", (payload: CancelOrderPayload) => {
      try {
        const room = getRoom(payload.roomCode);
        if (!room) {
          emitError(socket, "no_room", "Room not found.");
          return;
        }
        cancelOrder(room, payload.playerId, payload.orderId);
        emitFullState(io, room);
      } catch (err) {
        if (err instanceof OrderValidationError) {
          emitError(socket, err.code, err.message);
        } else {
          emitError(
            socket,
            "cancel_failed",
            err instanceof Error ? err.message : "Failed to cancel.",
          );
        }
      }
    });

    socket.on("cancel_all_orders", (payload: CancelAllOrdersPayload) => {
      try {
        const room = getRoom(payload.roomCode);
        if (!room) {
          emitError(socket, "no_room", "Room not found.");
          return;
        }
        cancelAllOrdersForPlayer(room, payload.playerId);
        emitFullState(io, room);
      } catch (err) {
        emitError(
          socket,
          "cancel_all_failed",
          err instanceof Error ? err.message : "Failed to cancel all.",
        );
      }
    });

    socket.on("reconnect_player", (payload: ReconnectPayload) => {
      try {
        const room = getRoom(payload.roomCode);
        if (!room) {
          emitError(socket, "no_room", "Room not found.");
          return;
        }
        const player = findPlayerById(room, payload.playerId);
        if (!player) {
          emitError(socket, "no_player", "Player not in room.");
          return;
        }
        player.socketId = socket.id;
        if (player.status === "disconnected") {
          player.status = "alive";
          player.disconnectedAtSecond = null;
          room.eventLog.push({
            id: createEventId(),
            type: "player_reconnected",
            elapsedSecond: room.elapsedSeconds,
            timestamp: Date.now(),
            message: `${player.name} reconnected.`,
            data: { playerId: player.id },
          });
        }
        socket.join(room.roomCode);
        socket.emit("room_joined", {
          roomCode: room.roomCode,
          playerId: player.id,
          isHost: player.isHost,
        });
        emitFullState(io, room);
      } catch (err) {
        emitError(
          socket,
          "reconnect_failed",
          err instanceof Error ? err.message : "Failed to reconnect.",
        );
      }
    });

    socket.on("disconnect", () => {
      const found = findRoomBySocketId(socket.id);
      if (!found) return;
      const { room, player } = found;

      if (room.phase === "lobby") {
        removePlayerFromLobby(room, player.id);
        const stillExists = getRoom(room.roomCode);
        if (stillExists) {
          emitFullState(io, stillExists);
        }
      } else if (room.phase === "active") {
        if (player.status === "alive") {
          player.status = "disconnected";
          player.disconnectedAtSecond = room.elapsedSeconds;
          player.socketId = null;
          room.eventLog.push({
            id: createEventId(),
            type: "player_disconnected",
            elapsedSecond: room.elapsedSeconds,
            timestamp: Date.now(),
            message: `${player.name} disconnected.`,
            data: { playerId: player.id },
          });
          emitFullState(io, room);
        } else {
          player.socketId = null;
        }
      } else {
        player.socketId = null;
      }
    });
  });
}

export const _GAME_TICK_REF = gameTick;
