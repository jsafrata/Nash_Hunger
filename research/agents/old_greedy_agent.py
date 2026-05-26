"""GreedyAgent — reactive panic-driven survivor.

For each required food, the agent looks at its survival timer (available units
== seconds until starvation under the canonical 1-unit-per-second consumption
rate) and chooses one of three actions:

    survival ≤ 2  →  PANIC.    Bid 5 units at price 10 (the max). Under
                                 maker-price matching, a $10 bid sweeps any
                                 ask priced ≤ $10 at the asker's price, so
                                 this is the strongest possible immediate
                                 buy in the discretized v1 action space.

    survival ≤ 6  →  HURRY.    Bid 3 units at min(best_ask + 1, 10). Lifts
                                 the best ask if one exists, but doesn't
                                 sweep deep depth. Cheaper than panic.

    survival ≤ 15 →  STOCKPILE. Post a *passive* bid for 2 units below the
                                 spread (best_bid + 1, capped to 4). Sits
                                 on the book and only fills if a seller
                                 hits it — the goal is cheap accumulation,
                                 not paying ask price.

    survival > 15 →  no buy on this food.

For its own produced food, when ≥ 5 surplus units are available, the agent
posts an ask for 3-5 units at best_bid + 1 (a passive markup over the best
bid).

One action per tick. Multiple candidate actions are scored by urgency (lower
survival = higher urgency). Most-urgent buy beats sell beats no-op.

This agent is deterministic given a seed — the seed parameter is accepted for
API compatibility but no randomness is used.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from env.actions import (
    ACTION_NOOP,
    PRICE_BUCKETS,
    QTY_BUCKETS,
    encode_trade,
)

from .base import Agent

# Tier thresholds (in survival ticks)
PANIC_THRESHOLD = 2
HURRY_THRESHOLD = 6
STOCKPILE_THRESHOLD = 15

# Sell trigger (own surplus units)
SELL_MIN_SURPLUS = 5


def _bucket_qty(target: int) -> int:
    """Largest QTY_BUCKETS index whose value is ≤ target. -1 if target<1."""
    if target < QTY_BUCKETS[0]:
        return -1
    chosen = 0
    for i, q in enumerate(QTY_BUCKETS):
        if q <= target:
            chosen = i
        else:
            break
    return chosen


def _bucket_price(target: int) -> int:
    """Bucket index whose price is closest to target (clamped)."""
    if target <= PRICE_BUCKETS[0]:
        return 0
    if target >= PRICE_BUCKETS[-1]:
        return len(PRICE_BUCKETS) - 1
    best_i, best_d = 0, abs(target - PRICE_BUCKETS[0])
    for i, p in enumerate(PRICE_BUCKETS):
        d = abs(target - p)
        if d < best_d:
            best_i, best_d = i, d
    return best_i


def _best_ask(obs: Dict[str, Any], food: str) -> Optional[int]:
    asks = obs["order_books"][food]["asks"]
    return asks[0]["price"] if asks else None


def _best_bid(obs: Dict[str, Any], food: str) -> Optional[int]:
    bids = obs["order_books"][food]["bids"]
    return bids[0]["price"] if bids else None


def _last_trade(obs: Dict[str, Any], food: str) -> Optional[int]:
    return obs["order_books"][food]["last_trade_price"]


class OldGreedyAgent(Agent):
    name = "old_greedy"

    def __init__(self, seed: Optional[int] = None) -> None:
        # Deterministic: seed is unused but accepted for API symmetry with
        # RandomAgent so the runner can pass a per-slot seed uniformly.
        del seed

    # ------------------------------------------------------------------
    # Candidate builders — each returns (qty_bucket, price_bucket) or None.
    # ------------------------------------------------------------------

    def _buy_candidate(
        self, obs: Dict[str, Any], food: str, avail_cash: int
    ) -> Optional[Tuple[int, int]]:
        survival = obs["available_inventory"][food]

        if survival <= PANIC_THRESHOLD:
            # PANIC: max-price sweep
            price, qty = PRICE_BUCKETS[-1], 5
        elif survival <= HURRY_THRESHOLD:
            # HURRY: lift the best ask
            ask = _best_ask(obs, food)
            ref = ask if ask is not None else 6
            price = min(ref + 1, PRICE_BUCKETS[-1])
            qty = 3
        elif survival <= STOCKPILE_THRESHOLD:
            # STOCKPILE: passive bid below the spread
            bid = _best_bid(obs, food)
            ref = bid if bid is not None else (_last_trade(obs, food) or 3)
            price = max(PRICE_BUCKETS[0], min(ref + 1, 4))
            qty = 2
        else:
            return None

        max_qty_by_cash = avail_cash // max(1, price)
        eff_qty = min(qty, max_qty_by_cash)
        if eff_qty < 1:
            return None
        qb = _bucket_qty(eff_qty)
        if qb < 0:
            return None
        return qb, _bucket_price(price)

    def _sell_candidate(
        self, obs: Dict[str, Any]
    ) -> Optional[Tuple[int, int]]:
        own = obs["produces"]
        if not own:
            return None
        avail = obs["available_inventory"][own]
        if avail < SELL_MIN_SURPLUS:
            return None
        bid = _best_bid(obs, own)
        last = _last_trade(obs, own)
        ref = bid if bid is not None else (last if last is not None else 4)
        price = max(3, ref + 1)
        qty = min(5, max(2, avail // 3))
        qb = _bucket_qty(qty)
        if qb < 0:
            return None
        return qb, _bucket_price(price)

    # ------------------------------------------------------------------

    def act(self, obs: Dict[str, Any], legal_mask: np.ndarray) -> int:
        if obs["status"] != "alive":
            return ACTION_NOOP

        candidates: List[Tuple[float, int]] = []
        avail_cash = obs["available_cash"]

        # Buy candidates — urgency = 100 - survival (higher = more urgent)
        for food in obs["required_foods"]:
            built = self._buy_candidate(obs, food, avail_cash)
            if built is None:
                continue
            qb, pb = built
            a = encode_trade("bid", food, qb, pb)
            if not legal_mask[a]:
                continue
            urgency = 100.0 - float(obs["available_inventory"][food])
            candidates.append((urgency, a))

        # Sell candidate — urgency = 10 (always loses to a real buy candidate)
        sell = self._sell_candidate(obs)
        if sell is not None:
            qb, pb = sell
            a = encode_trade("ask", obs["produces"], qb, pb)
            if legal_mask[a]:
                candidates.append((10.0, a))

        if not candidates:
            return ACTION_NOOP
        candidates.sort(key=lambda x: -x[0])
        return candidates[0][1]