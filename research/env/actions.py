"""Discrete action space for the simulator.

Layout (410 actions total):

  0..399   trade actions: (side ∈ {bid, ask}) × (food ∈ {A,B,C,D}) ×
                          (qty ∈ QTY_BUCKETS) × (price ∈ PRICE_BUCKETS)
           with index = side*200 + food*50 + qty_bucket*10 + price_bucket
  400..407 cancel actions: (side ∈ {bid, ask}) × (food ∈ {A,B,C,D})
           index = 400 + side*4 + food_idx
           Effect: cancel this player's oldest open order on that side+food
  408      cancel-all
  409      no-op
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Tuple

import numpy as np

from .config import GameConfig
from .market import (
    OrderError,
    cancel_all_for_player,
    cancel_oldest_for_player_side_food,
    post_order,
)
from .types import GameState

# ---------------------------------------------------------------------------
# Bucket definitions
# ---------------------------------------------------------------------------

QTY_BUCKETS: Tuple[int, ...] = (1, 2, 4, 8, 16)
PRICE_BUCKETS: Tuple[int, ...] = (1, 2, 3, 4, 5, 6, 7, 8, 9, 10)
SIDES: Tuple[str, ...] = ("bid", "ask")
FOODS: Tuple[str, ...] = ("A", "B", "C", "D")

NUM_FOODS = len(FOODS)
NUM_QTY = len(QTY_BUCKETS)
NUM_PRICE = len(PRICE_BUCKETS)
NUM_SIDES = len(SIDES)

NUM_TRADE_ACTIONS = NUM_SIDES * NUM_FOODS * NUM_QTY * NUM_PRICE  # 400
NUM_CANCEL_ACTIONS = NUM_SIDES * NUM_FOODS  # 8
ACTION_CANCEL_BASE = NUM_TRADE_ACTIONS  # 400
ACTION_CANCEL_ALL = ACTION_CANCEL_BASE + NUM_CANCEL_ACTIONS  # 408
ACTION_NOOP = ACTION_CANCEL_ALL + 1  # 409
NUM_ACTIONS = ACTION_NOOP + 1  # 410


# ---------------------------------------------------------------------------
# Action decode
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class TradeAction:
    side: str
    food_type: str
    quantity: int
    price_per_unit: int


@dataclass(frozen=True)
class CancelAction:
    side: str
    food_type: str


@dataclass(frozen=True)
class CancelAllAction:
    pass


@dataclass(frozen=True)
class NoopAction:
    pass


def encode_trade(side: str, food: str, qty_bucket: int, price_bucket: int) -> int:
    side_idx = SIDES.index(side)
    food_idx = FOODS.index(food)
    return side_idx * (NUM_FOODS * NUM_QTY * NUM_PRICE) + food_idx * (NUM_QTY * NUM_PRICE) + qty_bucket * NUM_PRICE + price_bucket


def decode(action: int):
    if action < 0 or action >= NUM_ACTIONS:
        raise ValueError(f"action {action} out of range")
    if action == ACTION_NOOP:
        return NoopAction()
    if action == ACTION_CANCEL_ALL:
        return CancelAllAction()
    if action >= ACTION_CANCEL_BASE:
        rel = action - ACTION_CANCEL_BASE
        side = SIDES[rel // NUM_FOODS]
        food = FOODS[rel % NUM_FOODS]
        return CancelAction(side=side, food_type=food)
    # trade action
    side_idx, rest = divmod(action, NUM_FOODS * NUM_QTY * NUM_PRICE)
    food_idx, rest = divmod(rest, NUM_QTY * NUM_PRICE)
    qty_idx, price_idx = divmod(rest, NUM_PRICE)
    return TradeAction(
        side=SIDES[side_idx],
        food_type=FOODS[food_idx],
        quantity=QTY_BUCKETS[qty_idx],
        price_per_unit=PRICE_BUCKETS[price_idx],
    )


# ---------------------------------------------------------------------------
# Legal action mask
# ---------------------------------------------------------------------------


def legal_action_mask(state: GameState, player_idx: int) -> np.ndarray:
    """A boolean mask of length NUM_ACTIONS. True bits = legal for this player.

    Always at least one legal action: if dead, only noop (409).
    """
    mask = np.zeros(NUM_ACTIONS, dtype=bool)
    mask[ACTION_NOOP] = True

    p = state.players[player_idx]
    if p.status != "alive" or state.phase != "active":
        return mask

    config: GameConfig = state.config  # type: ignore[assignment]
    avail_cash = p.available_cash()

    # Trade actions
    for side_idx, side in enumerate(SIDES):
        for food_idx, food in enumerate(FOODS):
            avail_food = p.available(food)
            for qb, qty in enumerate(QTY_BUCKETS):
                for pb, price in enumerate(PRICE_BUCKETS):
                    idx = (
                        side_idx * (NUM_FOODS * NUM_QTY * NUM_PRICE)
                        + food_idx * (NUM_QTY * NUM_PRICE)
                        + qb * NUM_PRICE
                        + pb
                    )
                    if side == "bid":
                        if qty * price <= avail_cash:
                            mask[idx] = True
                    else:
                        if qty <= avail_food:
                            mask[idx] = True

    # Cancel actions: only legal if there's at least one open order on that side+food
    for side_idx, side in enumerate(SIDES):
        for food_idx, food in enumerate(FOODS):
            book = state.order_books[food]
            pool = book.bids if side == "bid" else book.asks
            if any(o.player_idx == player_idx for o in pool):
                mask[ACTION_CANCEL_BASE + side_idx * NUM_FOODS + food_idx] = True

    # cancel-all is legal only if at least one open order exists for this player
    if any(mask[ACTION_CANCEL_BASE : ACTION_CANCEL_BASE + NUM_CANCEL_ACTIONS]):
        mask[ACTION_CANCEL_ALL] = True

    return mask


# ---------------------------------------------------------------------------
# Apply
# ---------------------------------------------------------------------------


def apply_action(
    state: GameState, player_idx: int, action: int
) -> dict:
    """Decode + apply. On illegal action, returns {"applied": False, "code": ...}.
    On success, returns {"applied": True, "kind": ..., "trades": [...] (only if trade)}.
    The simulator never raises on illegal — we silently no-op so RL agents can't
    crash the env.
    """
    decoded = decode(action)
    p = state.players[player_idx]
    if p.status != "alive":
        return {"applied": False, "code": "player_dead"}
    if state.phase != "active":
        return {"applied": False, "code": "game_not_active"}

    if isinstance(decoded, NoopAction):
        return {"applied": True, "kind": "noop"}

    if isinstance(decoded, CancelAllAction):
        cancelled = cancel_all_for_player(state, player_idx=player_idx)
        return {"applied": True, "kind": "cancel_all", "cancelled": len(cancelled)}

    if isinstance(decoded, CancelAction):
        cancelled = cancel_oldest_for_player_side_food(
            state,
            player_idx=player_idx,
            side=decoded.side,
            food_type=decoded.food_type,
        )
        if cancelled is None:
            return {"applied": False, "code": "no_order_to_cancel"}
        return {"applied": True, "kind": "cancel", "order_id": cancelled.id}

    # TradeAction
    try:
        order, trades = post_order(
            state,
            player_idx=player_idx,
            side=decoded.side,
            food_type=decoded.food_type,
            quantity=decoded.quantity,
            price_per_unit=decoded.price_per_unit,
        )
    except OrderError as e:
        return {"applied": False, "code": e.code}
    return {
        "applied": True,
        "kind": "trade_post",
        "order_id": order.id,
        "n_trades": len(trades),
    }
