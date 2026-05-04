"""FoodTradingEnv — the multi-agent simulator.

API (mirrors the requirements doc §4):

    env = FoodTradingEnv(seed=42)
    obs = env.reset()
    while not env.is_done():
        actions = {i: agents[i].act(obs[i], env.legal_actions(i)) for i in range(4)}
        obs, rewards, done, info = env.step(actions)
    result = env.get_result()
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from .actions import (
    ACTION_NOOP,
    NUM_ACTIONS,
    apply_action,
    legal_action_mask,
)
from .config import DEFAULT_CONFIG, GameConfig
from .observation import build_all_observations, build_observation
from .rng import make_rng
from .setup import initial_state
from .tick import end_game, step_tick
from .types import GameState


@dataclass
class StepInfo:
    """Returned alongside (obs, rewards, done, info) for diagnostics."""

    tick: int
    actions_applied: Dict[int, dict]
    deaths_this_tick: List[int]
    end_reason: Optional[str]


class FoodTradingEnv:
    """Pure-Python deterministic simulator. No threads, no real time."""

    def __init__(
        self,
        seed: int = 0,
        config: GameConfig = DEFAULT_CONFIG,
        player_names: Optional[List[str]] = None,
    ) -> None:
        self.config = config
        self.player_names = player_names or [f"P{i}" for i in range(config.player_count)]
        if len(self.player_names) != config.player_count:
            raise ValueError(
                f"need {config.player_count} player_names, got {len(self.player_names)}"
            )
        self.seed = seed
        self.state: GameState = self._build_state(seed)
        self._last_step_info: Optional[StepInfo] = None

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def _build_state(self, seed: int) -> GameState:
        rng = make_rng(seed)
        return initial_state(self.config, rng, self.player_names)

    def reset(self, seed: Optional[int] = None) -> Dict[int, Dict[str, Any]]:
        if seed is not None:
            self.seed = seed
        self.state = self._build_state(self.seed)
        self._last_step_info = None
        return build_all_observations(self.state)

    # ------------------------------------------------------------------
    # Per-step
    # ------------------------------------------------------------------

    def step(
        self,
        actions: Dict[int, int],
    ) -> Tuple[
        Dict[int, Dict[str, Any]],
        Dict[int, float],
        bool,
        StepInfo,
    ]:
        """Apply each agent's action (in agent-index order, deterministic),
        then advance one second (production → consumption → death checks).

        Reward returned each step = 0 (terminal-only reward at game end).
        For shaped rewards, wrap this env or use the info dict.
        """
        if self.state.phase != "active":
            # Already over — return zero rewards and a no-op tick.
            return (
                build_all_observations(self.state),
                {i: 0.0 for i in range(self.config.player_count)},
                True,
                StepInfo(
                    tick=self.state.elapsed_seconds,
                    actions_applied={},
                    deaths_this_tick=[],
                    end_reason=self.state.end_reason,
                ),
            )

        applied: Dict[int, dict] = {}
        for idx in range(self.config.player_count):
            a = actions.get(idx, ACTION_NOOP)
            applied[idx] = apply_action(self.state, idx, a)

        tick_result = step_tick(self.state)

        rewards = {i: 0.0 for i in range(self.config.player_count)}
        if tick_result.ended:
            # Terminal reward: 1 for sole winner, 1/k for k-way tie, 0 otherwise.
            winners = self.state.winner_idxs
            if winners:
                share = 1.0 / len(winners)
                for w in winners:
                    rewards[w] = share

        info = StepInfo(
            tick=self.state.elapsed_seconds,
            actions_applied=applied,
            deaths_this_tick=[d["player_idx"] for d in tick_result.deaths],
            end_reason=tick_result.end_reason,
        )
        self._last_step_info = info
        return (
            build_all_observations(self.state),
            rewards,
            tick_result.ended or self.state.phase == "ended",
            info,
        )

    # ------------------------------------------------------------------
    # Inspection
    # ------------------------------------------------------------------

    def observe(self, player_idx: int) -> Dict[str, Any]:
        return build_observation(self.state, player_idx)

    def legal_actions(self, player_idx: int) -> np.ndarray:
        return legal_action_mask(self.state, player_idx)

    def is_done(self) -> bool:
        return self.state.phase == "ended"

    def get_result(self) -> Dict[str, Any]:
        return {
            "winner_idxs": list(self.state.winner_idxs),
            "end_reason": self.state.end_reason,
            "elapsed_seconds": self.state.elapsed_seconds,
            "n_trades": len(self.state.trades),
            "players": [
                {
                    "idx": p.idx,
                    "name": p.name,
                    "produces": p.produces,
                    "status": p.status,
                    "died_at": p.died_at_second,
                    "final_cash": p.cash,
                    "final_inventory": dict(p.inventory),
                    "total_bought": p.total_bought,
                    "total_sold": p.total_sold,
                    "cash_from_trades": p.cash_from_trades,
                    "cash_spent_on_trades": p.cash_spent_on_trades,
                }
                for p in self.state.players
            ],
        }

    # ------------------------------------------------------------------
    # Helpers for debugging / tests
    # ------------------------------------------------------------------

    def render_text(self) -> str:
        s = self.state
        lines = [
            f"tick={s.elapsed_seconds}/{self.config.game_duration_seconds}  phase={s.phase}",
        ]
        for p in s.players:
            inv = " ".join(f"{f}={p.inventory[f]}" for f in self.config.food_types)
            lines.append(
                f"  P{p.idx} {p.name:6s} {p.status:5s} produces={p.produces or '?':2s} "
                f"cash={p.cash:4d} (res {p.reserved_cash:3d})  {inv}"
            )
        for f in self.config.food_types:
            book = s.order_books[f]
            lines.append(
                f"  book[{f}] bids={len(book.bids)} asks={len(book.asks)}"
            )
        return "\n".join(lines)
