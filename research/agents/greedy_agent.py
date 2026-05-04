"""Greedy agent — direct port of the live game's bot in backend/src/game/bot.ts.

Strategy:
  - For each required food, look at survival timer (available units == seconds left).
    Tier the urgency:
      ≤2s  : try to lift the best ask (or pay top-of-book + 0). Buy up to 5.
      ≤6s  : moderate bid near the spread. Buy up to 3.
      ≤20s : speculative cheap bid. Buy up to 2.
      else : occasional skip / very cheap bid.
  - For own produced food, sell surplus when avail ≥ 5 at best_bid + small markup.

Returns ONE action per tick (the most urgent one) since the discrete action
space allows one action per agent per step.
"""
from __future__ import annotations

import random
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from env.actions import (
    ACTION_NOOP,
    PRICE_BUCKETS,
    QTY_BUCKETS,
    encode_trade,
)

from .base import Agent


def _bucket_qty(target: int) -> int:
    """Pick the largest QTY_BUCKETS index whose value is ≤ target. -1 if target<1."""
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
    """Pick the bucket index whose price is closest to target (clamped to range)."""
    if target <= PRICE_BUCKETS[0]:
        return 0
    if target >= PRICE_BUCKETS[-1]:
        return len(PRICE_BUCKETS) - 1
    best_i = 0
    best_d = abs(target - PRICE_BUCKETS[0])
    for i, p in enumerate(PRICE_BUCKETS):
        d = abs(target - p)
        if d < best_d:
            best_i = i
            best_d = d
    return best_i


class GreedyAgent(Agent):
    name = "greedy"

    def __init__(self, seed: Optional[int] = None) -> None:
        self.rng = random.Random(seed)

    def _best_ask(self, obs: Dict[str, Any], food: str) -> Optional[int]:
        asks = obs["order_books"][food]["asks"]
        return asks[0]["price"] if asks else None

    def _best_bid(self, obs: Dict[str, Any], food: str) -> Optional[int]:
        bids = obs["order_books"][food]["bids"]
        return bids[0]["price"] if bids else None

    def _last_trade(self, obs: Dict[str, Any], food: str) -> Optional[int]:
        return obs["order_books"][food]["last_trade_price"]

    def _build_buy_candidate(
        self, obs: Dict[str, Any], food: str, avail_cash: int
    ) -> Optional[Tuple[int, int]]:
        """Return (qty_bucket, price_bucket) or None if no sensible buy."""
        survival = obs["available_inventory"][food]
        last = self._last_trade(obs, food)
        ask = self._best_ask(obs, food)

        if survival <= 2:
            ref = ask if ask is not None else (last if last is not None else 10)
            price = max(ref, 8)  # be willing to pay
            target_qty = 5
        elif survival <= 6:
            ref = ask if ask is not None else (last if last is not None else 6)
            price = max(5, min(ref + 1, 10))
            target_qty = 3
        elif survival <= 20:
            ref = ask if ask is not None else (last if last is not None else 4)
            price = max(2, min(ref, 6))
            target_qty = 2
        else:
            # speculative — only sometimes
            if self.rng.random() < 0.5:
                return None
            price = 2
            target_qty = 1

        # Don't bid more than affordable
        max_qty_by_cash = avail_cash // max(1, price)
        eff_qty = min(target_qty, max_qty_by_cash)
        if eff_qty < 1:
            return None

        qb = _bucket_qty(eff_qty)
        pb = _bucket_price(price)
        if qb < 0:
            return None
        return qb, pb

    def _build_sell_candidate(
        self, obs: Dict[str, Any]
    ) -> Optional[Tuple[int, int]]:
        own = obs["produces"]
        if not own:
            return None
        avail = obs["available_inventory"][own]
        if avail < 5:
            return None
        bid = self._best_bid(obs, own)
        last = self._last_trade(obs, own)
        ref = bid if bid is not None else (last if last is not None else 5)
        price = max(3, ref + 1 + self.rng.randint(0, 1))
        target_qty = min(5, max(2, avail // 3))
        qb = _bucket_qty(target_qty)
        pb = _bucket_price(price)
        if qb < 0:
            return None
        return qb, pb

    def act(self, obs: Dict[str, Any], legal_mask: np.ndarray) -> int:
        if obs["status"] != "alive":
            return ACTION_NOOP

        # Gather candidate actions tagged with urgency
        candidates: List[Tuple[float, int]] = []  # (priority, action_idx)

        avail_cash = obs["available_cash"]

        # Buy candidates — priority = inverse of survival (more urgent = higher)
        for food in obs["required_foods"]:
            built = self._build_buy_candidate(obs, food, avail_cash)
            if built is None:
                continue
            qb, pb = built
            action = encode_trade("bid", food, qb, pb)
            if not legal_mask[action]:
                continue
            survival = obs["available_inventory"][food]
            urgency = 100.0 - float(survival)  # higher = more urgent
            candidates.append((urgency, action))

        # Sell candidate
        sell = self._build_sell_candidate(obs)
        if sell is not None:
            qb, pb = sell
            action = encode_trade("ask", obs["produces"], qb, pb)
            if legal_mask[action]:
                candidates.append((10.0, action))  # mid priority

        if not candidates:
            return ACTION_NOOP
        candidates.sort(key=lambda x: -x[0])  # highest urgency first
        return candidates[0][1]
