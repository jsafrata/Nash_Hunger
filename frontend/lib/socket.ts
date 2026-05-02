"use client";

import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getBackendUrl(): string {
  return process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";
}

export function getSocket(): Socket {
  if (typeof window === "undefined") {
    throw new Error("getSocket called on server");
  }
  if (!socket) {
    const url = getBackendUrl();
    // eslint-disable-next-line no-console
    console.log("[socket] connecting to", url);
    socket = io(url, {
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
    });
    socket.on("connect", () => {
      // eslint-disable-next-line no-console
      console.log("[socket] connected", socket?.id);
    });
    socket.on("connect_error", (err) => {
      // eslint-disable-next-line no-console
      console.error("[socket] connect_error:", err.message);
    });
    socket.on("disconnect", (reason) => {
      // eslint-disable-next-line no-console
      console.warn("[socket] disconnected:", reason);
    });
  }
  return socket;
}

export const STORAGE_KEY = "ftsg_session";

export interface StoredSession {
  roomCode: string;
  playerId: string;
  playerName: string;
}

export function saveSession(s: StoredSession): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function loadSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
