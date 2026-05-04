"""Drive the Python sim using a fixed Scenario (deterministic deck/producers/actions)
and produce the same JSON output shape as backend/src/test/headless_parity.ts.
"""
from __future__ import annotations

from typing import Any, Dict, List

from env.config import DEFAULT_CONFIG, GameConfig
from env.market import (
    cancel_all_for_player,
    cancel_oldest_for_player_side_food,
    post_order,
    OrderError,
)
from env.tick import end_game, kill_player, produce_food, consume_and_kill
from env.types import GameState, OrderBook, Player, empty_inventory
from .scenario import Scenario


def _build_state_from_scenario(config: GameConfig, scn: Scenario) -> GameState:
    if len(scn.producers) != config.player_count:
        raise ValueError("bad scenario: wrong number of producers")
    expected_deck = config.player_count * config.initial_units_per_player
    if len(scn.deck) != expected_deck:
        raise ValueError(
            f"bad scenario: deck has {len(scn.deck)} entries, expected {expected_deck}"
        )

    players: List[Player] = []
    for i, prod in enumerate(scn.producers):
        p = Player(idx=i, name=f"P{i}")
        p.produces = prod
        p.cash = config.initial_cash
        players.append(p)

    state = GameState(
        config=config,
        players=players,
        order_books={f: OrderBook(food_type=f) for f in config.food_types},
        elapsed_seconds=0,
        phase="active",
    )

    cursor = 0
    for p in players:
        p.inventory = empty_inventory()
        for _ in range(config.initial_units_per_player):
            p.inventory[scn.deck[cursor]] += 1
            cursor += 1
    return state


def _apply_action(state: GameState, player_idx: int, action: dict) -> None:
    p = state.players[player_idx]
    if p.status != "alive":
        return
    t = action["type"]
    if t == "noop":
        return
    try:
        if t == "trade":
            post_order(
                state,
                player_idx=player_idx,
                side=action["side"],
                food_type=action["food"],
                quantity=action["qty"],
                price_per_unit=action["price"],
            )
        elif t == "cancel_all":
            cancel_all_for_player(state, player_idx=player_idx)
        elif t == "cancel":
            cancel_oldest_for_player_side_food(
                state,
                player_idx=player_idx,
                side=action["side"],
                food_type=action["food"],
            )
    except OrderError:
        pass


def _step_tick(state: GameState) -> None:
    """Mirrors backend/src/test/headless_parity.ts → runTick:
        actions already applied → advance → produce → consume → end checks
    """
    config: GameConfig = state.config  # type: ignore[assignment]
    if state.phase != "active":
        return
    state.elapsed_seconds += 1
    produce_food(state)
    deaths = consume_and_kill(state)
    for d in deaths:
        kill_player(state, state.players[d["player_idx"]], d["missing_foods"])
    alive = state.alive_count()
    if state.elapsed_seconds >= config.game_duration_seconds:
        end_game(state, "time_limit")
    elif alive == 0:
        end_game(state, "no_survivors")
    elif alive == 1:
        end_game(state, "single_survivor")


def run(scn: Scenario, config: GameConfig = DEFAULT_CONFIG) -> Dict[str, Any]:
    state = _build_state_from_scenario(config, scn)
    for tick_actions in scn.actions:
        if state.phase == "ended":
            break
        for i in range(config.player_count):
            a = tick_actions.get(str(i), {"type": "noop"})
            _apply_action(state, i, a)
        _step_tick(state)

    if state.phase != "ended":
        # Ran out of scripted actions without ending. Treat current state as final.
        state.winner_idxs = []  # left undefined; not compared by parity anyway

    return {
        "elapsed_seconds": state.elapsed_seconds,
        "end_reason": state.end_reason,
        "winner_idxs": list(state.winner_idxs),
        "trades": [
            {
                "buyer_idx": t.buyer_idx,
                "seller_idx": t.seller_idx,
                "food": t.food_type,
                "price": t.price_per_unit,
                "qty": t.quantity,
                "tick": t.elapsed_second,
            }
            for t in state.trades
        ],
        "players": [
            {
                "idx": p.idx,
                "produces": p.produces,
                "status": p.status,
                "died_at": p.died_at_second,
                "cash": p.cash,
                "inventory": dict(p.inventory),
                "total_bought": p.total_bought,
                "total_sold": p.total_sold,
            }
            for p in state.players
        ],
    }
