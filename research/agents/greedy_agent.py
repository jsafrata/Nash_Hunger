"""GreedyAgent — value-based survivor/trader.

This policy replaces the old tiered heuristic with a simple stateful model:

- derive a normalized per-food value from the current inventory vector
- rescale those values into market dollars using public prices
- estimate each opponent's cash and stock of the food they produce
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

from env.actions import ACTION_NOOP, PRICE_BUCKETS, QTY_BUCKETS, encode_trade
from env.config import DEFAULT_CONFIG, FOOD_TYPES

from .base import Agent

DEFAULT_MARKET_ANCHOR = 4.0
ABSOLUTE_VALUE_SCALE = 4.0
MIN_PRODUCED_FOOD_RESERVE = 1


@dataclass
class OpponentEstimate:
    cash: float
    produced_inventory: float
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


def _best_ask(obs: Dict[str, Any], food: str) -> Optional[int]:
    asks = obs["order_books"][food]["asks"]
    return asks[0]["price"] if asks else None


def _best_bid(obs: Dict[str, Any], food: str) -> Optional[int]:
    bids = obs["order_books"][food]["bids"]
    return bids[0]["price"] if bids else None


def _last_trade(obs: Dict[str, Any], food: str) -> Optional[int]:
    return obs["order_books"][food]["last_trade_price"]


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
                produced_inventory=float(expected_per_food),
                produces=p["produces"],
                alive=p["status"] == "alive",
            )
        self._last_tick = tick

    def _advance_estimates(self, obs: Dict[str, Any]) -> None:
        tick = obs["tick"]
        delta = max(0, tick - self._last_tick)
        if delta > 0:
            production = DEFAULT_CONFIG.production_per_second
            players_by_idx = {p["idx"]: p for p in obs["players"]}
            for idx, estimate in self._estimates.items():
                public = players_by_idx.get(idx)
                if public is None:
                    continue
                estimate.alive = public["status"] == "alive"
                if estimate.alive:
                    estimate.produced_inventory += production * delta
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
        players_by_idx = {p["idx"]: p for p in obs["players"]}

        for trade in obs["recent_trades"]:
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
                buyer_public = players_by_idx.get(buyer_idx)
                if buyer_public and buyer_public["produces"] == food:
                    buyer_est.produced_inventory += trade["qty"]
            if seller_est is not None:
                seller_est.cash += price_total
                seller_public = players_by_idx.get(seller_idx)
                if seller_public and seller_public["produces"] == food:
                    seller_est.produced_inventory = max(
                        0.0, seller_est.produced_inventory - trade["qty"]
                    )

        self._seen_trade_counts = current_counts

    def _estimate_unknown_required_units(self, tick: int) -> float:
        start = DEFAULT_CONFIG.initial_units_per_player / len(FOOD_TYPES)
        consume = DEFAULT_CONFIG.consumption_per_required_food_per_second
        return max(0.0, start - tick * consume)

    def _estimated_inventory_for_player(
        self, obs: Dict[str, Any], player_idx: int
    ) -> Dict[str, float]:
        public = next(p for p in obs["players"] if p["idx"] == player_idx)
        produces = public["produces"]
        tick = obs["tick"]
        unknown_required = self._estimate_unknown_required_units(tick)

        inventory = {food: unknown_required for food in FOOD_TYPES}
        if produces:
            estimate = self._estimates.get(player_idx)
            inventory[produces] = (
                estimate.produced_inventory if estimate is not None else unknown_required
            )
        return inventory

    def _normalized_food_values(
        self,
        inventory: Dict[str, float],
        produces: Optional[str],
        required_foods: List[str],
    ) -> Dict[str, float]:
        values = {food: 0.0 for food in FOOD_TYPES}
        if not required_foods:
            return values

        for food in required_foods:
            units = max(1.0, float(inventory.get(food, 0.0)))
            values[food] = 1.0 / (1.0 + units / ABSOLUTE_VALUE_SCALE)
        if produces:
            values[produces] = 0.0
        return values

    def _market_anchor(
        self,
        obs: Dict[str, Any],
        normalized: Dict[str, float],
        side: str,
    ) -> float:
        ratios: List[float] = []

        for food in FOOD_TYPES:
            norm = normalized[food]
            if norm <= 0.0:
                continue

            book = obs["order_books"][food]
            levels = book["asks"] if side == "buy" else book["bids"]
            if levels:
                ratios.append(float(levels[0]["price"]) / norm)
                continue

            last_trade = book["last_trade_price"]
            if last_trade is not None:
                ratios.append(float(last_trade) / norm)

        if ratios:
            return float(sum(ratios) / len(ratios))
        return DEFAULT_MARKET_ANCHOR

    def _unnormalize_food_values(
        self, normalized: Dict[str, float], market_anchor: float
    ) -> Dict[str, float]:
        return {food: normalized[food] * market_anchor for food in FOOD_TYPES}

    def _opponent_value_for_food(
        self, obs: Dict[str, Any], player_idx: int, food: str, market_anchor: float
    ) -> float:
        public = next(p for p in obs["players"] if p["idx"] == player_idx)
        inventory = self._estimated_inventory_for_player(obs, player_idx)
        required = [f for f in FOOD_TYPES if f != public["produces"]]
        normalized = self._normalized_food_values(
            inventory=inventory,
            produces=public["produces"],
            required_foods=required,
        )
        return normalized[food] * market_anchor

    def _best_buy_candidate(
        self,
        obs: Dict[str, Any],
        normalized: Dict[str, float],
        legal_mask: np.ndarray,
        dollar_values: Dict[str, float],
    ) -> Optional[Tuple[float, int]]:
        available_cash = obs["available_cash"]
        candidates: List[Tuple[float, int]] = []

        for food in obs["required_foods"]:
            available_units = obs["available_inventory"][food]
            per_unit_value = min(float(available_cash), dollar_values[food])
            if per_unit_value < 1.0:
                continue

            best_ask = _best_ask(obs, food)
            if best_ask is None or best_ask > per_unit_value:
                continue

            target_price = float(best_ask)

            price_bucket = _bucket_price(target_price)
            unit_price = PRICE_BUCKETS[price_bucket]
            max_qty_by_cash = available_cash // unit_price
            if max_qty_by_cash < 1:
                continue

            value_budget = max(float(unit_price), float(available_cash) * normalized[food])
            max_qty_by_value = int(value_budget // unit_price)
            best_ask_qty = obs["order_books"][food]["asks"][0]["qty"]
            qty_target = min(max_qty_by_cash, max_qty_by_value, best_ask_qty)
            qty_bucket = _bucket_qty(qty_target)
            if qty_bucket < 0:
                continue

            action = encode_trade("bid", food, qty_bucket, price_bucket)
            if not legal_mask[action]:
                continue

            underpricing = dollar_values[food] - float(unit_price)
            scarcity = 1.0 / max(1.0, float(available_units))
            candidates.append(((underpricing * 1000.0) + scarcity, action))

        if not candidates:
            return None
        candidates.sort(key=lambda item: (-item[0], item[1]))
        return candidates[0]

    def _best_sell_candidate(
        self,
        obs: Dict[str, Any],
        legal_mask: np.ndarray,
        sell_anchor: float,
    ) -> Optional[Tuple[float, int]]:
        own_food = obs["produces"]
        if not own_food:
            return None

        own_available = obs["available_inventory"][own_food]
        qty_target = own_available - MIN_PRODUCED_FOOD_RESERVE
        qty_bucket = _bucket_qty(qty_target)
        if qty_bucket < 0:
            return None

        willingness = 0.0
        for p in obs["players"]:
            idx = p["idx"]
            if idx == obs["player_idx"] or p["status"] != "alive":
                continue
            estimate = self._estimates.get(idx)
            if estimate is None:
                continue
            opponent_value = self._opponent_value_for_food(
                obs=obs,
                player_idx=idx,
                food=own_food,
                market_anchor=sell_anchor,
            )
            willingness = max(willingness, min(estimate.cash, opponent_value))

        floor_price = max(1.0, willingness)
        price_bucket = _bucket_price(floor_price)
        action = encode_trade("ask", own_food, qty_bucket, price_bucket)
        if not legal_mask[action]:
            return None
        return (PRICE_BUCKETS[price_bucket] * QTY_BUCKETS[qty_bucket], action)

    def act(self, obs: Dict[str, Any], legal_mask: np.ndarray) -> int:
        if obs["status"] != "alive":
            return ACTION_NOOP

        self._ensure_initialized(obs)
        self._advance_estimates(obs)
        self._ingest_recent_trades(obs)

        normalized = self._normalized_food_values(
            inventory={f: float(obs["available_inventory"][f]) for f in FOOD_TYPES},
            produces=obs["produces"],
            required_foods=obs["required_foods"],
        )
        buy_anchor = self._market_anchor(obs, normalized, "buy")
        sell_anchor = self._market_anchor(obs, normalized, "sell")
        dollar_values = self._unnormalize_food_values(normalized, buy_anchor)

        buy_candidate = self._best_buy_candidate(obs, normalized, legal_mask, dollar_values)
        if buy_candidate is not None and buy_candidate[0] > 0:
            return buy_candidate[1]

        sell_candidate = self._best_sell_candidate(obs, legal_mask, sell_anchor)
        if sell_candidate is not None and sell_candidate[0] > 0:
            return sell_candidate[1]

        return ACTION_NOOP
