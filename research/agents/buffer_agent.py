"""BufferAgent — maintains a target survival buffer for each required food.

  - If avail[food] < target_low → bid moderately (target price = recent trade or 4).
  - If avail[food] < target_critical → bid aggressively (top of book or last trade + 1).
  - Otherwise sell own production at modest markup over best bid.

Different from GreedyAgent in that it pre-emptively builds a stockpile rather
than reacting to imminent starvation.
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
from .greedy_agent import _bucket_price, _bucket_qty


class BufferAgent(Agent):
    name = "buffer"

    def __init__(
        self,
        target_low: int = 25,
        target_critical: int = 8,
    ) -> None:
        self.target_low = target_low
        self.target_critical = target_critical

    def act(self, obs: Dict[str, Any], legal_mask: np.ndarray) -> int:
        if obs["status"] != "alive":
            return ACTION_NOOP

        candidates: List[Tuple[float, int]] = []

        avail_cash = obs["available_cash"]

        for food in obs["required_foods"]:
            survival = obs["available_inventory"][food]
            asks = obs["order_books"][food]["asks"]
            best_ask = asks[0]["price"] if asks else None
            last = obs["order_books"][food]["last_trade_price"]
            if survival < self.target_critical:
                # Aggressive: pay top of book
                price = max(best_ask if best_ask is not None else 8, last or 6, 7)
                qty = 4
                urgency = 100.0
            elif survival < self.target_low:
                # Modest accumulation
                ref = last if last is not None else 4
                price = max(3, min(ref + 1, 6))
                qty = 2
                urgency = 50.0 - survival
            else:
                continue
            max_qty = avail_cash // max(1, price)
            qty = min(qty, max_qty)
            if qty < 1:
                continue
            qb = _bucket_qty(qty)
            pb = _bucket_price(price)
            if qb < 0:
                continue
            a = encode_trade("bid", food, qb, pb)
            if legal_mask[a]:
                candidates.append((urgency, a))

        # Sell own production whenever we have surplus
        own = obs["produces"]
        if own:
            avail_own = obs["available_inventory"][own]
            if avail_own >= 6:
                bids = obs["order_books"][own]["bids"]
                best_bid = bids[0]["price"] if bids else None
                last = obs["order_books"][own]["last_trade_price"]
                ref = best_bid if best_bid is not None else (last if last is not None else 5)
                price = max(3, ref + 1)
                qty = min(4, avail_own // 3)
                qb = _bucket_qty(qty)
                pb = _bucket_price(price)
                if qb >= 0:
                    a = encode_trade("ask", own, qb, pb)
                    if legal_mask[a]:
                        candidates.append((20.0, a))

        if not candidates:
            return ACTION_NOOP
        candidates.sort(key=lambda x: -x[0])
        return candidates[0][1]
