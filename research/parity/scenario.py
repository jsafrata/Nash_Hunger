"""Build deterministic scenarios that can be replayed identically by both the
Python sim and the canonical TypeScript implementation.

A scenario fully specifies:
  - producers per player (list of length 4, e.g. ["A","B","C","D"])
  - deck of 400 food units in deal order (first 100 → P0, next 100 → P1, ...)
  - per-tick actions: list[dict[player_idx -> ActionDescriptor]]

ActionDescriptor is a JSON-serializable dict matching what
backend/src/test/headless_parity.ts expects:
    {"type": "trade", "side": "bid"|"ask", "food": "A".."D", "qty": int, "price": int}
    {"type": "cancel", "side": "bid"|"ask", "food": "A".."D"}
    {"type": "cancel_all"}
    {"type": "noop"}
"""
from __future__ import annotations

import json
import random
from dataclasses import dataclass
from typing import Dict, List

from env.actions import (
    ACTION_NOOP,
    CancelAction,
    CancelAllAction,
    NoopAction,
    NUM_ACTIONS,
    TradeAction,
    decode,
)
from env.config import DEFAULT_CONFIG, FOOD_TYPES


@dataclass
class Scenario:
    producers: List[str]
    deck: List[str]
    actions: List[Dict[str, dict]]  # keys are str player_idx ("0".."3")

    def to_json(self) -> str:
        return json.dumps(
            {"producers": self.producers, "deck": self.deck, "actions": self.actions}
        )


def build_scenario(seed: int, n_ticks: int = 60) -> Scenario:
    """A single scenario seeded by `seed`. Producer order is a fixed permutation
    derived from the seed; deck is a shuffle; per-tick actions are sampled
    uniformly over the discrete action space (without legality filtering, since
    both sides handle illegal-as-noop)."""
    rnd = random.Random(seed)

    producers = list(FOOD_TYPES)
    rnd.shuffle(producers)

    deck: List[str] = []
    for f in FOOD_TYPES:
        deck.extend([f] * DEFAULT_CONFIG.initial_units_per_food_type)
    rnd.shuffle(deck)

    actions_per_tick: List[Dict[str, dict]] = []
    for _t in range(n_ticks):
        per_player: Dict[str, dict] = {}
        for i in range(DEFAULT_CONFIG.player_count):
            ai = rnd.randrange(NUM_ACTIONS)
            per_player[str(i)] = action_int_to_dict(ai)
        actions_per_tick.append(per_player)

    return Scenario(producers=producers, deck=deck, actions=actions_per_tick)


def action_int_to_dict(action_int: int) -> dict:
    d = decode(action_int)
    if isinstance(d, NoopAction):
        return {"type": "noop"}
    if isinstance(d, CancelAllAction):
        return {"type": "cancel_all"}
    if isinstance(d, CancelAction):
        return {"type": "cancel", "side": d.side, "food": d.food_type}
    if isinstance(d, TradeAction):
        return {
            "type": "trade",
            "side": d.side,
            "food": d.food_type,
            "qty": d.quantity,
            "price": d.price_per_unit,
        }
    raise ValueError(f"unknown action descriptor: {d!r}")


def action_dict_to_int(d: dict) -> int:
    """Inverse of action_int_to_dict (for replay through the Python env)."""
    from env.actions import (
        ACTION_CANCEL_ALL,
        ACTION_CANCEL_BASE,
        FOODS,
        NUM_FOODS,
        SIDES,
        encode_trade,
        QTY_BUCKETS,
        PRICE_BUCKETS,
    )

    t = d["type"]
    if t == "noop":
        return ACTION_NOOP
    if t == "cancel_all":
        return ACTION_CANCEL_ALL
    if t == "cancel":
        side_idx = SIDES.index(d["side"])
        food_idx = FOODS.index(d["food"])
        return ACTION_CANCEL_BASE + side_idx * NUM_FOODS + food_idx
    if t == "trade":
        qb = QTY_BUCKETS.index(d["qty"])
        pb = PRICE_BUCKETS.index(d["price"])
        return encode_trade(d["side"], d["food"], qb, pb)
    raise ValueError(f"unknown action type: {t}")
