"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useGameState } from "../../../hooks/useGameState";
import { getSocket, loadSession, saveSession } from "../../../lib/socket";
import type { FoodType } from "../../../lib/types";
import { TimerBar } from "../../../components/TimerBar";
import { PlayerPanel } from "../../../components/PlayerPanel";
import { ResourcesPanel } from "../../../components/ResourcesPanel";
import { OrderEntry } from "../../../components/OrderEntry";
import { OrderBookView } from "../../../components/OrderBookView";
import { OwnOrders } from "../../../components/OwnOrders";
import { RecentTrades } from "../../../components/RecentTrades";
import { EventLog } from "../../../components/EventLog";
import { Lobby } from "../../../components/Lobby";
import { GameOverModal } from "../../../components/GameOverModal";

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = (params.roomCode as string)?.toUpperCase() ?? "";
  const game = useGameState();
  const [selectedFood, setSelectedFood] = useState<FoodType>("A");
  const [pickTrigger, setPickTrigger] = useState(0);
  const [joinName, setJoinName] = useState("");
  const [needsJoin, setNeedsJoin] = useState(false);

  const pickFood = (f: FoodType) => {
    setSelectedFood(f);
    setPickTrigger((n) => n + 1);
  };

  useEffect(() => {
    if (!roomCode) return;
    const sock = getSocket();
    const tryJoin = () => {
      const session = loadSession();
      if (session && session.roomCode === roomCode && session.playerId) {
        sock.emit("reconnect_player", {
          roomCode,
          playerId: session.playerId,
        });
      } else {
        setNeedsJoin(true);
      }
    };
    if (sock.connected) tryJoin();
    else sock.once("connect", tryJoin);
    return () => {
      sock.off("connect", tryJoin);
    };
  }, [roomCode]);

  useEffect(() => {
    if (game.roomCode && game.playerId) {
      const sess = loadSession();
      saveSession({
        roomCode: game.roomCode,
        playerId: game.playerId,
        playerName: sess?.playerName ?? joinName,
      });
      setNeedsJoin(false);
    }
  }, [game.roomCode, game.playerId, joinName]);

  if (needsJoin && !game.playerId) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="card p-6 max-w-md w-full">
          <div className="text-xs text-muted uppercase tracking-wider mb-1">
            Join room
          </div>
          <div className="text-3xl font-bold text-accent mono mb-4">
            {roomCode}
          </div>
          <label className="block text-[11px] text-muted uppercase tracking-wider mb-1">
            Display name
          </label>
          <input
            type="text"
            value={joinName}
            onChange={(e) => setJoinName(e.target.value)}
            placeholder="Your name"
            maxLength={20}
            className="w-full mb-3"
          />
          <button
            onClick={() => {
              if (!joinName.trim()) return;
              getSocket().emit("join_room", {
                roomCode,
                playerName: joinName.trim(),
              });
            }}
            className="btn btn-primary w-full"
          >
            Join
          </button>
          <button
            onClick={() => router.push("/")}
            className="btn-ghost w-full mt-2"
          >
            Cancel
          </button>
          {game.lastError && (
            <div className="mt-3 text-xs text-danger border border-danger/30 bg-danger/10 rounded px-3 py-2">
              {game.lastError.message}
            </div>
          )}
        </div>
      </main>
    );
  }

  const phase = game.publicState?.phase ?? "lobby";

  if (phase === "lobby") {
    return (
      <main className="min-h-screen flex flex-col items-center p-4 gap-4">
        <div className="w-full max-w-7xl">
          <TimerBar
            publicState={game.publicState}
            connected={game.connected}
            roomCode={roomCode}
          />
        </div>
        <div className="flex-1 flex items-center w-full justify-center">
          <Lobby
            socket={game.socket}
            roomCode={roomCode}
            playerId={game.playerId ?? ""}
            isHost={game.isHost}
            players={game.publicState?.players ?? []}
          />
        </div>
      </main>
    );
  }

  const dead =
    game.publicState?.players.find((p) => p.id === game.playerId)?.status ===
    "dead";
  const inputDisabled = phase !== "active" || dead;

  return (
    <main className="min-h-screen p-4 flex flex-col gap-3 max-w-7xl mx-auto">
      <TimerBar
        publicState={game.publicState}
        connected={game.connected}
        roomCode={roomCode}
      />

      {dead && phase === "active" && (
        <div className="card p-3 text-center text-danger border-danger/40 text-sm">
          You have died. Spectating until the game ends.
        </div>
      )}

      {game.lastError && (
        <div className="card p-3 text-sm text-danger border-danger/40">
          {game.lastError.message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-3 flex flex-col gap-3">
          <PlayerPanel
            players={game.publicState?.players ?? []}
            selfId={game.playerId}
          />
          <ResourcesPanel priv={game.privateState} />
        </div>

        <div className="lg:col-span-5 flex flex-col gap-3">
          <OrderBookView
            orderBooks={game.orderBooks}
            selectedFood={selectedFood}
            setSelectedFood={pickFood}
          />
          <OrderEntry
            socket={game.socket}
            roomCode={roomCode}
            playerId={game.playerId ?? ""}
            selectedFood={selectedFood}
            setSelectedFood={pickFood}
            priv={game.privateState}
            disabled={inputDisabled}
            pickTrigger={pickTrigger}
          />
          <OwnOrders
            socket={game.socket}
            roomCode={roomCode}
            playerId={game.playerId ?? ""}
            orders={game.ownOrders}
            disabled={inputDisabled}
          />
        </div>

        <div className="lg:col-span-4 flex flex-col gap-3">
          <RecentTrades trades={game.publicState?.recentTrades ?? []} />
          <EventLog events={game.publicState?.publicEventLog ?? []} />
        </div>
      </div>

      {game.gameOver && (
        <GameOverModal payload={game.gameOver} selfId={game.playerId} />
      )}
    </main>
  );
}
