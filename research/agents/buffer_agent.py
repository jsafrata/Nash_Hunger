"""BufferAgent — proactive stockpiler.

Maintains a target survival buffer for each required food. Where Greedy waits
until starvation is imminent, Buffer keeps buying while comfortable so the
buffer never thins.

For each required food:

    survival < target_critical  →  CRITICAL. Bid 4 units at price 10 (max).
                                    Same panic-sweep behavior as Greedy panic;
                                    triggers earlier (default at 8 vs Greedy's 2).

    < target_full               →  BUILD. Passive bid for 2 units at
                                    best_bid + 1 (capped to a low ceiling).
                                    Sits on the book for cheap accumulation.
                                    The gap between target_critical and
                                    target_full is where this agent puts in
                                    most of its work.

    ≥ target_full               →  no buy on this food.

For its own produced food, when ≥ 6 surplus units are available, posts an ask
for 2-4 units at best_bid + 1 (passive markup over the best bid).

Defaults: target_critical=8, target_full=25.

Different from Greedy in two ways:
  1. Buys (passively) up to 25-tick survival; Greedy stops at 15.
  2. Triggers panic at 8 ticks; Greedy at 2. Wider safety margin.

One action per tick. Below target_full, buying always beats selling. Above,
the agent only sells.

Deterministic given configuration.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from env.actions import (
    ACTION_NOOP,
    PRICE_BUCKETS,
    encode_trade,
)

from .base import Agent
from .greedy_agent import (
    _best_ask,
    _best_bid,
    _bucket_price,
    _bucket_qty,
    _last_trade,
)

# Sell trigger (own surplus units) — buffer is more conservative than greedy.
SELL_MIN_SURPLUS = 6


class BufferAgent(Agent):
    name = "buffer"

    def __init__(
        self,
        target_full: int = 25,
        target_critical: int = 8,
    ) -> None:
        if target_critical >= target_full:
            raise ValueError(
                f"target_critical ({target_critical}) must be < target_full ({target_full})"
            )
        self.target_full = target_full
        self.target_critical = target_critical

    # ------------------------------------------------------------------

    def _buy_candidate(
        self, obs: Dict[str, Any], food: str, avail_cash: int
    ) -> Optional[Tuple[int, int, float]]:
        """Returns (qty_bucket, price_bucket, urgency) or None."""
        survival = obs["available_inventory"][food]

        if survival < self.target_critical:
            # CRITICAL: max-price sweep
            price, qty = PRICE_BUCKETS[-1], 4
            urgency = 100.0
        elif survival < self.target_full:
            # BUILD: passive bid below the spread
            bid = _best_bid(obs, food)
            last = _last_trade(obs, food)
            ref = bid if bid is not None else (last if last is not None else 3)
            price = max(PRICE_BUCKETS[0], min(ref + 1, 4))
            qty = 2
            # Urgency drops as buffer grows; always > sell priority (20).
            urgency = float(self.target_full - survival) + 25.0
        else:
            return None

        max_qty_by_cash = avail_cash // max(1, price)
        eff_qty = min(qty, max_qty_by_cash)
        if eff_qty < 1:
            return None
        qb = _bucket_qty(eff_qty)
        if qb < 0:
            return None
        return qb, _bucket_price(price), urgency

    def _sell_candidate(
        self, obs: Dict[str, Any]
    ) -> Optional[Tuple[int, int]]:
        own = obs["produces"]
        if not own:
            return None
        avail_own = obs["available_inventory"][own]
        if avail_own < SELL_MIN_SURPLUS:
            return None
        bid = _best_bid(obs, own)
        last = _last_trade(obs, own)
        ref = bid if bid is not None else (last if last is not None else 4)
        price = max(3, ref + 1)
        qty = min(4, avail_own // 3)
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

        for food in obs["required_foods"]:
            built = self._buy_candidate(obs, food, avail_cash)
            if built is None:
                continue
            qb, pb, urgency = built
            a = encode_trade("bid", food, qb, pb)
            if legal_mask[a]:
                candidates.append((urgency, a))

        sell = self._sell_candidate(obs)
        if sell is not None:
            qb, pb = sell
            a = encode_trade("ask", obs["produces"], qb, pb)
            if legal_mask[a]:
                candidates.append((20.0, a))

        if not candidates:
            return ACTION_NOOP
        candidates.sort(key=lambda x: -x[0])
        return candidates[0][1]
