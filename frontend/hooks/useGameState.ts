"use client";

import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { getSocket } from "../lib/socket";
import type {
  ErrorMessage,
  FoodType,
  GameOverPayload,
  OwnOrderView,
  PrivatePlayerState,
  PublicGameState,
  PublicOrderBook,
  PublicTrade,
  RoomJoinedPayload,
} from "../lib/types";

export interface GameStateBundle {
  socket: Socket | null;
  connected: boolean;
  roomCode: string | null;
  playerId: string | null;
  isHost: boolean;
  publicState: PublicGameState | null;
  privateState: PrivatePlayerState | null;
  ownOrders: OwnOrderView[];
  orderBooks: Record<FoodType, PublicOrderBook> | null;
  recentTradeFlash: PublicTrade | null;
  gameOver: GameOverPayload | null;
  lastError: ErrorMessage | null;
  setRoomMeta: (roomCode: string, playerId: string, isHost: boolean) => void;
}

export function useGameState(): GameStateBundle {
  const [connected, setConnected] = useState(false);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [publicState, setPublicState] = useState<PublicGameState | null>(null);
  const [privateState, setPrivateState] = useState<PrivatePlayerState | null>(null);
  const [ownOrders, setOwnOrders] = useState<OwnOrderView[]>([]);
  const [orderBooks, setOrderBooks] = useState<Record<FoodType, PublicOrderBook> | null>(null);
  const [recentTradeFlash, setRecentTradeFlash] = useState<PublicTrade | null>(null);
  const [gameOver, setGameOver] = useState<GameOverPayload | null>(null);
  const [lastError, setLastError] = useState<ErrorMessage | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const sock = getSocket();
    socketRef.current = sock;

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onRoomJoined = (p: RoomJoinedPayload) => {
      setRoomCode(p.roomCode);
      setPlayerId(p.playerId);
      setIsHost(p.isHost);
    };
    const onRoomUpdate = (p: PublicGameState) => setPublicState(p);
    const onPrivate = (p: PrivatePlayerState) => setPrivateState(p);
    const onOwnOrders = (p: OwnOrderView[]) => setOwnOrders(p);
    const onOrderBooks = (p: Record<FoodType, PublicOrderBook>) => setOrderBooks(p);
    const onTrade = (p: any) => {
      setRecentTradeFlash({
        id: p.id ?? "",
        foodType: p.foodType,
        buyerId: p.buyerId,
        buyerName: "",
        sellerId: p.sellerId,
        sellerName: "",
        pricePerUnit: p.pricePerUnit,
        quantity: p.quantity,
        totalPrice: p.totalPrice,
        elapsedSecond: 0,
      });
    };
    const onGameOver = (p: GameOverPayload) => setGameOver(p);
    const onError = (p: ErrorMessage) => setLastError(p);

    sock.on("connect", onConnect);
    sock.on("disconnect", onDisconnect);
    sock.on("room_joined", onRoomJoined);
    sock.on("room_update", onRoomUpdate);
    sock.on("private_update", onPrivate);
    sock.on("own_orders_update", onOwnOrders);
    sock.on("order_book_update", onOrderBooks);
    sock.on("trade_executed", onTrade);
    sock.on("game_over", onGameOver);
    sock.on("error_message", onError);

    if (sock.connected) setConnected(true);

    return () => {
      sock.off("connect", onConnect);
      sock.off("disconnect", onDisconnect);
      sock.off("room_joined", onRoomJoined);
      sock.off("room_update", onRoomUpdate);
      sock.off("private_update", onPrivate);
      sock.off("own_orders_update", onOwnOrders);
      sock.off("order_book_update", onOrderBooks);
      sock.off("trade_executed", onTrade);
      sock.off("game_over", onGameOver);
      sock.off("error_message", onError);
    };
  }, []);

  return {
    socket: socketRef.current,
    connected,
    roomCode,
    playerId,
    isHost,
    publicState,
    privateState,
    ownOrders,
    orderBooks,
    recentTradeFlash,
    gameOver,
    lastError,
    setRoomMeta: (rc, pid, host) => {
      setRoomCode(rc);
      setPlayerId(pid);
      setIsHost(host);
    },
  };
}
