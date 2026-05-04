"""Per-game logging. Writes a single JSON file with the full game record."""
from __future__ import annotations

import json
import os
import time
from dataclasses import asdict
from pathlib import Path
from typing import Any, Dict, List, Optional


class GameLogger:
    """Append events during the game; flush a single JSON on close.

    Events are not deeply nested — the file is essentially a flat record:
        seed, agent_types, initial_state, ticks, actions, orders, trades,
        deaths, winner, final_state.
    """

    def __init__(self, out_dir: str | os.PathLike, game_id: str) -> None:
        self.out_dir = Path(out_dir)
        self.out_dir.mkdir(parents=True, exist_ok=True)
        self.game_id = game_id
        self.path = self.out_dir / f"{game_id}.json"
        self.record: Dict[str, Any] = {
            "game_id": game_id,
            "wall_clock_start": time.time(),
            "seed": None,
            "agent_types": [],
            "initial": {},
            "ticks": [],  # one entry per env.step
            "result": None,
        }

    def set_meta(
        self, seed: int, agent_types: List[str], initial: Dict[str, Any]
    ) -> None:
        self.record["seed"] = seed
        self.record["agent_types"] = agent_types
        self.record["initial"] = initial

    def log_step(
        self,
        tick: int,
        actions: Dict[int, int],
        applied_info: Dict[int, dict],
        deaths: List[int],
        snapshots: Optional[Dict[int, Dict[str, Any]]] = None,
    ) -> None:
        self.record["ticks"].append(
            {
                "tick": tick,
                "actions": actions,
                "applied": applied_info,
                "deaths": deaths,
                "snapshots": snapshots or {},
            }
        )

    def set_result(self, result: Dict[str, Any]) -> None:
        self.record["result"] = result
        self.record["wall_clock_end"] = time.time()
        self.record["wall_clock_seconds"] = (
            self.record["wall_clock_end"] - self.record["wall_clock_start"]
        )

    def flush(self) -> Path:
        with self.path.open("w") as f:
            json.dump(self.record, f, default=str)
        return self.path
