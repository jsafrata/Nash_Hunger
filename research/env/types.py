"""Data types for the simulator. Mirrors backend/src/types.ts."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Literal


PlayerStatus = Literal["alive", "dead"]
OrderSide = Literal["bid", "ask"]
OrderStatus = Literal["open", "partially_filled", "filled", "cancelled"]
GamePhase = Literal["lobby", "active", "ended"]
GameEndReason = Literal["time_limit", "single_survivor", "no_survivors"]


def empty_inventory() -> Dict[str, int]:
    return {"A": 0, "B": 0, "C": 0, "D": 0}


@dataclass
class Order:
    id: int
    player_idx: int
    food_type: str
    side: OrderSide
    price_per_unit: int
    original_quantity: int
    remaining_quantity: int
    status: OrderStatus
    created_at_tick: int
    sequence: int  # monotonically increasing — tie-breaker for price-time priority


@dataclass
class Trade:
    id: int
    food_type: str
    buyer_idx: int
    seller_idx: int
    price_per_unit: int
    quantity: int
    total_price: int
    maker_order_id: int
    taker_order_id: int
    elapsed_second: int


@dataclass
class Player:
    idx: int
    name: str
    status: PlayerStatus = "alive"
    produces: str = ""
    cash: int = 0
    reserved_cash: int = 0
    inventory: Dict[str, int] = field(default_factory=empty_inventory)
    reserved_inventory: Dict[str, int] = field(default_factory=empty_inventory)
    died_at_second: Optional[int] = None
    total_bought: int = 0
    total_sold: int = 0
    cash_from_trades: int = 0
    cash_spent_on_trades: int = 0

    def available_cash(self) -> int:
        return self.cash - self.reserved_cash

    def available(self, food: str) -> int:
        return self.inventory[food] - self.reserved_inventory[food]


@dataclass
class OrderBook:
    food_type: str
    bids: List[Order] = field(default_factory=list)  # sorted: highest price, then earliest
    asks: List[Order] = field(default_factory=list)  # sorted: lowest price, then earliest


@dataclass
class GameState:
    config: object  # GameConfig (avoid circular import)
    players: List[Player] = field(default_factory=list)
    order_books: Dict[str, OrderBook] = field(default_factory=dict)
    trades: List[Trade] = field(default_factory=list)
    elapsed_seconds: int = 0
    phase: GamePhase = "lobby"
    end_reason: Optional[GameEndReason] = None
    winner_idxs: List[int] = field(default_factory=list)

    # Internal counters for unique ids
    _next_order_id: int = 0
    _next_trade_id: int = 0
    _next_sequence: int = 0

    # Per-tick rate limiting (tracked but not enforced for v1 — agents act at most once per tick anyway)
    orders_this_tick: Dict[int, int] = field(default_factory=dict)
    cancels_this_tick: Dict[int, int] = field(default_factory=dict)

    def alive_indices(self) -> List[int]:
        return [p.idx for p in self.players if p.status == "alive"]

    def alive_count(self) -> int:
        return sum(1 for p in self.players if p.status == "alive")

    def next_order_id(self) -> int:
        self._next_order_id += 1
        return self._next_order_id

    def next_trade_id(self) -> int:
        self._next_trade_id += 1
        return self._next_trade_id

    def next_sequence(self) -> int:
        self._next_sequence += 1
        return self._next_sequence
