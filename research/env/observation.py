"""Per-agent observation. Strict information barrier: agent only sees its own
private state plus the public market state. Mirrors backend/src/visibility/*.

Each observation is returned as a dict of plain Python objects + numpy arrays.
That makes it easy to inspect in tests and convert to a fixed-length tensor
later when wrapping for PettingZoo / Gymnasium.
"""
from __future__ import annotations

from typing import Any, Dict, List

import numpy as np

from .config import GameConfig
from .types import GameState

PUBLIC_BOOK_DEPTH = 5  # how many price levels to expose per side


def _aggregate_levels(orders) -> List[Dict[str, int]]:
    by_price: Dict[int, int] = {}
    for o in orders:
        by_price[o.price_per_unit] = by_price.get(o.price_per_unit, 0) + o.remaining_quantity
    return [{"price": p, "qty": q} for p, q in by_price.items()]


def _public_book(state: GameState, food: str) -> Dict[str, Any]:
    book = state.order_books[food]
    bids = sorted(_aggregate_levels(book.bids), key=lambda l: -l["price"])[:PUBLIC_BOOK_DEPTH]
    asks = sorted(_aggregate_levels(book.asks), key=lambda l: l["price"])[:PUBLIC_BOOK_DEPTH]
    last_trade = next(
        (t for t in reversed(state.trades) if t.food_type == food), None
    )
    return {
        "bids": bids,
        "asks": asks,
        "last_trade_price": last_trade.price_per_unit if last_trade else None,
        "last_trade_qty": last_trade.quantity if last_trade else None,
    }


def build_observation(state: GameState, player_idx: int) -> Dict[str, Any]:
    config: GameConfig = state.config  # type: ignore[assignment]
    p = state.players[player_idx]
    consume = config.consumption_per_required_food_per_second

    # Private (own) state
    available_inv = {f: p.available(f) for f in config.food_types}
    required = config.required_foods(p.produces) if p.produces else ()
    starvation_seconds = {
        f: max(0, available_inv[f] // consume) for f in required
    }

    own_orders = []
    for f in config.food_types:
        for o in state.order_books[f].bids + state.order_books[f].asks:
            if o.player_idx == player_idx:
                own_orders.append(
                    {
                        "id": o.id,
                        "side": o.side,
                        "food": o.food_type,
                        "price": o.price_per_unit,
                        "remaining_qty": o.remaining_quantity,
                        "original_qty": o.original_quantity,
                    }
                )

    # Public players state — alive/dead + producer + name only. NEVER cash/inventory.
    public_players = [
        {
            "idx": pl.idx,
            "name": pl.name,
            "produces": pl.produces,
            "status": pl.status,
            "died_at": pl.died_at_second,
        }
        for pl in state.players
    ]

    # Public order books
    books = {f: _public_book(state, f) for f in config.food_types}

    # Recent trades (public) — last 20
    recent_trades = [
        {
            "food": t.food_type,
            "buyer_idx": t.buyer_idx,
            "seller_idx": t.seller_idx,
            "price": t.price_per_unit,
            "qty": t.quantity,
            "tick": t.elapsed_second,
        }
        for t in state.trades[-20:]
    ]

    return {
        "player_idx": player_idx,
        "tick": state.elapsed_seconds,
        "remaining_seconds": max(
            0, config.game_duration_seconds - state.elapsed_seconds
        ),
        "phase": state.phase,
        # Private
        "cash": p.cash,
        "reserved_cash": p.reserved_cash,
        "available_cash": p.available_cash(),
        "inventory": dict(p.inventory),
        "reserved_inventory": dict(p.reserved_inventory),
        "available_inventory": available_inv,
        "produces": p.produces,
        "required_foods": list(required),
        "starvation_seconds": starvation_seconds,
        "status": p.status,
        "own_orders": own_orders,
        # Public
        "players": public_players,
        "order_books": books,
        "recent_trades": recent_trades,
    }


def build_all_observations(state: GameState) -> Dict[int, Dict[str, Any]]:
    return {p.idx: build_observation(state, p.idx) for p in state.players}
