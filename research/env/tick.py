"""Per-tick game progression: production, consumption, death, end-of-game.

Mirrors backend/src/game/{production, consumption, death, winner, tick}.ts.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional

from .config import GameConfig
from .market import cancel_all_for_player
from .types import GameEndReason, GameState, Player


@dataclass
class TickResult:
    deaths: List[dict]  # [{"player_idx": int, "missing_foods": [str, ...]}]
    ended: bool
    end_reason: Optional[GameEndReason]


def produce_food(state: GameState) -> None:
    config: GameConfig = state.config  # type: ignore[assignment]
    for p in state.players:
        if p.status != "alive":
            continue
        if not p.produces:
            continue
        p.inventory[p.produces] += config.production_per_second


def consume_and_kill(state: GameState) -> List[dict]:
    """Consume one unit of each required food per alive player. Players who can't
    consume any required food die at this tick. Returns list of death info dicts.

    Uses *available* (not total) inventory: food locked in open asks cannot save you.
    """
    config: GameConfig = state.config  # type: ignore[assignment]
    consume_amount = config.consumption_per_required_food_per_second
    deaths: List[dict] = []

    for p in state.players:
        if p.status != "alive":
            continue
        required = config.required_foods(p.produces)
        missing = [
            f for f in required if (p.inventory[f] - p.reserved_inventory[f]) < consume_amount
        ]
        if missing:
            deaths.append({"player_idx": p.idx, "missing_foods": list(missing)})
            continue
        for f in required:
            p.inventory[f] -= consume_amount

    return deaths


def kill_player(state: GameState, player: Player, _missing: List[str]) -> None:
    """Mark dead, cancel all open orders, zero out reservations.
    Mirrors backend/src/game/death.ts: orders are removed (not refunded into avail
    cash/inventory). Reservations on the dead player are simply zeroed.
    """
    player.status = "dead"
    player.died_at_second = state.elapsed_seconds
    cancel_all_for_player(state, player_idx=player.idx, release_reservations=False)
    player.reserved_cash = 0
    player.reserved_inventory = {"A": 0, "B": 0, "C": 0, "D": 0}


def step_tick(state: GameState) -> TickResult:
    """One simulation tick. Order:

      1. advance clock
      2. production (alive players gain own food)
      3. consumption + death checks
      4. end-of-game checks (time, single survivor, no survivors)

    Trade processing is NOT in here — orders are processed when posted (during
    the env.step() preamble). This matches the live game where orders execute
    immediately on submission rather than waiting for a tick.
    """
    result = TickResult(deaths=[], ended=False, end_reason=None)
    if state.phase != "active":
        result.ended = True
        return result

    state.elapsed_seconds += 1

    produce_food(state)

    death_infos = consume_and_kill(state)
    for d in death_infos:
        kill_player(state, state.players[d["player_idx"]], d["missing_foods"])
        result.deaths.append(d)

    config: GameConfig = state.config  # type: ignore[assignment]
    alive = state.alive_count()

    if state.elapsed_seconds >= config.game_duration_seconds:
        end_game(state, "time_limit")
        result.ended = True
        result.end_reason = "time_limit"
    elif alive == 0:
        end_game(state, "no_survivors")
        result.ended = True
        result.end_reason = "no_survivors"
    elif alive == 1:
        end_game(state, "single_survivor")
        result.ended = True
        result.end_reason = "single_survivor"

    return result


# ---------------------------------------------------------------------------
# End-of-game / winner
# ---------------------------------------------------------------------------


def total_inventory(player: Player) -> int:
    return sum(player.inventory.values())


def determine_winners(state: GameState) -> List[int]:
    survivors = [p for p in state.players if p.status == "alive"]
    if not survivors:
        return []
    if len(survivors) == 1:
        return [survivors[0].idx]
    max_cash = max(p.cash for p in survivors)
    leaders = [p for p in survivors if p.cash == max_cash]
    if len(leaders) == 1:
        return [leaders[0].idx]
    max_food = max(total_inventory(p) for p in leaders)
    return [p.idx for p in leaders if total_inventory(p) == max_food]


def end_game(state: GameState, reason: GameEndReason) -> None:
    if state.phase == "ended":
        return
    state.phase = "ended"
    state.end_reason = reason
    state.winner_idxs = determine_winners(state)
