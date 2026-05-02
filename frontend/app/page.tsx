"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBackendUrl, getSocket, saveSession } from "../lib/socket";
import { Logo } from "../components/Logo";

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [backendUrl, setBackendUrl] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("ftsg_name");
    if (stored) setName(stored);
    setBackendUrl(getBackendUrl());
    const sock = getSocket();
    setConnected(sock.connected);
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    sock.on("connect", onConnect);
    sock.on("disconnect", onDisconnect);
    return () => {
      sock.off("connect", onConnect);
      sock.off("disconnect", onDisconnect);
    };
  }, []);

  const submitWith = (
    eventName: "create_room" | "join_room",
    payload: Record<string, unknown>,
  ) => {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter a display name.");
      return;
    }
    setBusy(true);
    const sock = getSocket();

    const cleanup = () => {
      sock.off("room_joined", onJoined);
      sock.off("error_message", onError);
    };
    const onJoined = (p: { roomCode: string; playerId: string }) => {
      cleanup();
      try {
        localStorage.setItem("ftsg_name", trimmed);
      } catch {}
      saveSession({
        roomCode: p.roomCode,
        playerId: p.playerId,
        playerName: trimmed,
      });
      router.push(`/game/${p.roomCode}`);
    };
    const onError = (p: { code: string; message: string }) => {
      cleanup();
      setError(p.message);
      setBusy(false);
    };
    sock.on("room_joined", onJoined);
    sock.on("error_message", onError);

    const doEmit = () => sock.emit(eventName, payload);
    if (sock.connected) {
      doEmit();
    } else {
      sock.once("connect", doEmit);
    }

    // safety timeout in case nothing comes back
    setTimeout(() => {
      cleanup();
      if (busy) {
        setBusy(false);
      }
    }, 8000);
  };

  const create = () => {
    submitWith("create_room", { playerName: name.trim() });
  };

  const join = () => {
    if (!code.trim()) {
      setError("Please enter a room code.");
      return;
    }
    submitWith("join_room", {
      roomCode: code.trim().toUpperCase(),
      playerName: name.trim(),
    });
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-6">
          <Logo size={64} />
          <div className="text-3xl font-bold text-accent mt-3 mb-1 tracking-tight">
            Nash Hunger
          </div>
          <div className="text-sm text-muted">
            A 4-player real-time market survival game. Trade or starve.
          </div>
        </div>

        <div className="card p-6">
          <label className="block text-[11px] text-muted uppercase tracking-wider mb-1">
            Display name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full mb-4"
            maxLength={20}
          />

          <button
            onClick={create}
            disabled={busy || !connected}
            className="btn btn-primary w-full mb-4"
          >
            {busy
              ? "Creating…"
              : connected
                ? "Create new game"
                : "Connecting to server…"}
          </button>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-line" />
            <span className="text-[11px] text-muted uppercase tracking-wider">
              or join
            </span>
            <div className="flex-1 h-px bg-line" />
          </div>

          <label className="block text-[11px] text-muted uppercase tracking-wider mb-1">
            Room code
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC12"
              maxLength={5}
              className="flex-1 mono tracking-wider text-center"
            />
            <button onClick={join} disabled={busy} className="btn">
              Join
            </button>
          </div>

          {error && (
            <div className="mt-3 text-sm text-danger border border-danger/30 bg-danger/10 rounded px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <div className="mt-6 text-xs text-muted leading-relaxed text-center px-4">
          Don't have 3 friends? Create a game and click{" "}
          <span className="text-accent">Fill with bots</span> in the lobby.
        </div>

        <div className="mt-3 text-[10px] text-muted text-center font-mono opacity-50">
          backend: {backendUrl || "…"}{" "}
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full ml-1 ${
              connected ? "bg-bid" : "bg-danger"
            }`}
          />
        </div>
      </div>
    </main>
  );
}
