"""GreedyAgent — value-based survivor/trader.

This policy replaces the old tiered heuristic with a simple stateful model:

- derive a normalized per-food value from the current inventory vector
- rescale those values into market dollars using public prices
- estimate each opponent's cash and full food inventory
- buy the required food with the highest value-adjusted urgency
- otherwise sell produced surplus at the highest estimated opponent willingness

The agent only uses its observation plus internal estimates; it never reads
hidden env state.
"""
from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from env.actions import ACTION_CANCEL_ALL, ACTION_NOOP, PRICE_BUCKETS, QTY_BUCKETS, decode, encode_trade
from env.config import DEFAULT_CONFIG, FOOD_TYPES

from .base import Agent

DEFAULT_MARKET_ANCHOR = 4.0
MIN_PRODUCED_FOOD_RESERVE = 1
MAX_SELL_QUANTITY = 4


@dataclass
class OpponentEstimate:
    cash: float
    inventory: Dict[str, float]
    produces: str
    alive: bool = True


def _bucket_qty(target: int) -> int:
    """Largest quantity bucket whose value is <= target."""
    if target < QTY_BUCKETS[0]:
        return -1
    chosen = 0
    for i, qty in enumerate(QTY_BUCKETS):
        if qty <= target:
            chosen = i
        else:
            break
    return chosen


def _best_ask(obs: Dict[str, Any], food: str) -> Optional[int]:
    asks = obs["order_books"][food]["ask_orders"]
    return asks[0]["price"] if asks else None


def _best_bid(obs: Dict[str, Any], food: str) -> Optional[int]:
    bids = obs["order_books"][food]["bid_orders"]
    return bids[0]["price"] if bids else None


def _last_trade(obs: Dict[str, Any], food: str) -> Optional[int]:
    return obs["order_books"][food]["last_trade_price"]


def _bucket_price(target: float) -> int:
    """Closest price bucket, clamped to valid action space."""
    if target <= PRICE_BUCKETS[0]:
        return 0
    if target >= PRICE_BUCKETS[-1]:
        return len(PRICE_BUCKETS) - 1
    best_i = 0
    best_d = abs(target - PRICE_BUCKETS[0])
    for i, price in enumerate(PRICE_BUCKETS):
        dist = abs(target - price)
        if dist < best_d:
            best_i = i
            best_d = dist
    return best_i


class GreedyAgent(Agent):
    name = "greedy"

    def __init__(self, seed: Optional[int] = None) -> None:
        del seed
        self.reset()

    def reset(self) -> None:
        self._estimates: Dict[int, OpponentEstimate] = {}
        self._last_tick = 0
        self._self_idx: Optional[int] = None
        self._seen_trade_counts: Counter[Tuple[int, int, int, int, int, int]] = Counter()

    def _ensure_initialized(self, obs: Dict[str, Any]) -> None:
        player_idx = obs["player_idx"]
        tick = obs["tick"]
        if self._self_idx is not None and tick < self._last_tick:
            self.reset()
        if self._self_idx == player_idx and self._estimates:
            return

        self._self_idx = player_idx
        expected_per_food = (
            DEFAULT_CONFIG.initial_units_per_player / len(FOOD_TYPES)
        )
        self._estimates = {}
        for p in obs["players"]:
            idx = p["idx"]
            if idx == player_idx or not p["produces"]:
                continue
            self._estimates[idx] = OpponentEstimate(
                cash=float(DEFAULT_CONFIG.initial_cash),
                inventory={food: float(expected_per_food) for food in FOOD_TYPES},
                produces=p["produces"],
                alive=p["status"] == "alive",
            )
        self._last_tick = tick

    def _advance_estimates(self, obs: Dict[str, Any]) -> None:
        tick = obs["tick"]
        delta = max(0, tick - self._last_tick)
        if delta > 0:
            production = DEFAULT_CONFIG.production_per_second
            consumption = DEFAULT_CONFIG.consumption_per_required_food_per_second
            players_by_idx = {p["idx"]: p for p in obs["players"]}
            for idx, estimate in self._estimates.items():
                public = players_by_idx.get(idx)
                if public is None:
                    continue
                died_at = public["died_at"]
                if died_at is None:
                    alive_ticks = delta if public["status"] == "alive" else 0
                else:
                    alive_ticks = max(0, min(tick, died_at) - self._last_tick)

                for _ in range(alive_ticks):
                    for food in FOOD_TYPES:
                        if food == estimate.produces:
                            estimate.inventory[food] += production
                        else:
                            estimate.inventory[food] = max(
                                0.0, estimate.inventory[food] - consumption
                            )

                estimate.alive = public["status"] == "alive"
        self._last_tick = tick

    def _trade_signature(self, trade: Dict[str, Any]) -> Tuple[int, int, int, int, int, int]:
        return (
            trade["tick"],
            trade["buyer_idx"],
            trade["seller_idx"],
            trade["price"],
            trade["qty"],
            FOOD_TYPES.index(trade["food"]),
        )

    def _ingest_recent_trades(self, obs: Dict[str, Any]) -> None:
        current_counts = Counter(
            self._trade_signature(trade) for trade in obs["recent_trades"]
        )
        previous_tick = max(0, obs["tick"] - 1)

        for trade in obs["recent_trades"]:
            if trade["tick"] != previous_tick:
                continue
            sig = self._trade_signature(trade)
            if self._seen_trade_counts[sig] >= current_counts[sig]:
                continue
            self._seen_trade_counts[sig] += 1
            price_total = float(trade["price"] * trade["qty"])
            buyer_idx = trade["buyer_idx"]
            seller_idx = trade["seller_idx"]
            food = trade["food"]

            buyer_est = self._estimates.get(buyer_idx)
            seller_est = self._estimates.get(seller_idx)
            if buyer_est is not None:
                buyer_est.cash = max(0.0, buyer_est.cash - price_total)
                buyer_est.inventory[food] += trade["qty"]
            if seller_est is not None:
                seller_est.cash += price_total
                seller_est.inventory[food] = max(
                    0.0, seller_est.inventory[food] - trade["qty"]
                )

        self._seen_trade_counts = current_counts

    def _normalized_food_value(self, units: float) -> float:
        return 1 / (units + 0.2)

    def _opponent_normalized_food_value(self, units: float) -> float:
        return min(1 / (units + 0.2), 0.2)

    def _market_anchor(
        self,
        obs: Dict[str, Any],
    ) -> float:
        ratios: List[float] = []
        own_inventory = {food: float(obs["available_inventory"][food]) for food in FOOD_TYPES}

        for food in FOOD_TYPES:
            book = obs["order_books"][food]
            for bid in book["bid_orders"]:
                inventory = own_inventory
                if bid["player_idx"] != obs["player_idx"]:
                    inventory = self._estimates[bid["player_idx"]].inventory
                norm = self._normalized_food_value(inventory.get(food, 0.0))
                ratios.append(float(bid["price"]) / norm)
            for ask in book["ask_orders"]:
                inventory = own_inventory
                if ask["player_idx"] != obs["player_idx"]:
                    inventory = self._estimates[ask["player_idx"]].inventory
                norm = self._normalized_food_value(inventory.get(food, 0.0))
                ratios.append(float(ask["price"]) / norm)

        if ratios:
            return float(sum(ratios) / len(ratios))
        return DEFAULT_MARKET_ANCHOR

    def _best_buy_candidate(
        self,
        obs: Dict[str, Any],
        legal_mask: np.ndarray,
        market_anchor: float,
        available_cash_override: Optional[int] = None,
    ) -> Optional[Tuple[float, int]]:
        available_cash = (
            obs["available_cash"]
            if available_cash_override is None
            else available_cash_override
        )
        candidates: List[Tuple[float, int]] = []

        for food in obs["required_foods"]:
            available_units = obs["available_inventory"][food]
            if available_cash < 1 or market_anchor <= 0.0:
                continue

            for ask in obs["order_books"][food]["ask_orders"]:
                price_bucket = _bucket_price(float(ask["price"]))
                unit_price = PRICE_BUCKETS[price_bucket]
                if unit_price < 1:
                    continue

                max_qty = min(ask["qty"], available_cash // unit_price)
                if max_qty < 1:
                    continue

                normalized_price = float(unit_price) / market_anchor
                integrated_value = 0.0
                last_bucket_qty: Optional[int] = None
                last_bucket_value = 0.0

                for qty in range(1, max_qty + 1):
                    integrated_value += self._normalized_food_value(available_units)
                    if qty in QTY_BUCKETS:
                        last_bucket_qty = qty
                        last_bucket_value = integrated_value
                    if self._normalized_food_value(available_units) < normalized_price:
                        break

                if last_bucket_qty is None:
                    continue

                qty_bucket = _bucket_qty(last_bucket_qty)
                if qty_bucket < 0:
                    continue

                action = encode_trade("bid", food, qty_bucket, price_bucket)
                if not legal_mask[action]:
                    continue

                purchase_cost = float(last_bucket_qty * unit_price)
                profit = (last_bucket_value * market_anchor) - purchase_cost
                candidates.append((profit, action))

        if not candidates:
            return None
        candidates.sort(key=lambda item: (-item[0], item[1]))
        return candidates[0]

    def _best_sell_candidate(
        self,
        obs: Dict[str, Any],
        legal_mask: np.ndarray,
        market_anchor: float,
    ) -> Optional[Tuple[float, int]]:
        own_food = obs["produces"]
        if not own_food or market_anchor <= 0.0:
            return None

        own_available = obs["available_inventory"][own_food]
        max_sell_qty = min(MAX_SELL_QUANTITY, own_available)
        if max_sell_qty < 1:
            return None

        target_price = 0
        for player in obs["players"]:
            player_idx = player["idx"]
            if player_idx == obs["player_idx"] or player["status"] != "alive":
                continue
            estimate = self._estimates.get(player_idx)
            if estimate is None:
                continue
            opponent_value = 0.0
            if own_food != player["produces"]:
                opponent_value = (
                    self._opponent_normalized_food_value(
                        estimate.inventory.get(own_food, 0.0)
                    )
                    * market_anchor
                )
            target_price = max(target_price, min(opponent_value, estimate.cash))

        price_bucket = _bucket_price(target_price)
        ask_price = PRICE_BUCKETS[price_bucket]
        default_qty_bucket = _bucket_qty(max_sell_qty)
        if default_qty_bucket < 0:
            return None

        default_action = encode_trade("ask", own_food, default_qty_bucket, price_bucket)
        if not legal_mask[default_action]:
            return None

        best_profit = -1.0
        best_action = default_action
        for bid in obs["order_books"][own_food]["bid_orders"]:
            qty_target = min(max_sell_qty, bid["qty"])
            qty_bucket = _bucket_qty(qty_target)
            if qty_bucket < 0:
                continue
            action = encode_trade("ask", own_food, qty_bucket, price_bucket)
            if not legal_mask[action]:
                continue
            quantity = QTY_BUCKETS[qty_bucket]
            profit = (bid["price"] - ask_price) * quantity
            if profit > best_profit:
                best_profit = profit
                best_action = action

        return (best_profit, best_action)

    def act(self, obs: Dict[str, Any], legal_mask: np.ndarray) -> int:
        if obs["status"] != "alive":
            return ACTION_NOOP

        self._ensure_initialized(obs)
        self._advance_estimates(obs)
        self._ingest_recent_trades(obs)

        market_anchor = self._market_anchor(obs)

        buy_candidate = self._best_buy_candidate(obs, legal_mask, market_anchor)
        sell_candidate = self._best_sell_candidate(obs, legal_mask, market_anchor)
        buy_profit = buy_candidate[0] if buy_candidate is not None else float("-inf")
        sell_profit = sell_candidate[0] if sell_candidate is not None else float("-inf")

        if buy_profit > 0.0 or sell_profit > 0.0:
            if buy_profit > sell_profit and buy_candidate is not None:
                return buy_candidate[1]
            if sell_candidate is not None:
                return sell_candidate[1]

        if sell_candidate is not None:
            desired_sell_price = decode(sell_candidate[1]).price_per_unit
            stale_sell_orders = [
                order
                for order in obs["own_orders"]
                if order["side"] == "ask" and order["food"] == obs["produces"]
            ]
            sell_price_drifted = any(
                abs(order["price"] - desired_sell_price) > 2 for order in stale_sell_orders
            )
            if legal_mask[ACTION_CANCEL_ALL] and (
                sell_price_drifted
            ):
                return ACTION_CANCEL_ALL
            return sell_candidate[1]

        return ACTION_NOOP
