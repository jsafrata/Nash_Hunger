"""Tests for the order book + matching engine."""
import pytest

from env.config import DEFAULT_CONFIG
from env.market import (
    OrderError,
    cancel_all_for_player,
    cancel_oldest_for_player_side_food,
    cancel_order,
    post_order,
)
from env.rng import make_rng
from env.setup import initial_state


def fresh_state():
    rng = make_rng(0)
    state = initial_state(DEFAULT_CONFIG, rng, ["P0", "P1", "P2", "P3"])
    # Give every player exactly 50 of every food and 1000 cash to make tests
    # independent of the random deal.
    for p in state.players:
        p.inventory = {"A": 50, "B": 50, "C": 50, "D": 50}
        p.reserved_inventory = {"A": 0, "B": 0, "C": 0, "D": 0}
        p.cash = 1000
        p.reserved_cash = 0
    return state


# ---------------------------------------------------------------------------
# Maker-price matching
# ---------------------------------------------------------------------------


def test_resting_bid_takes_incoming_ask_at_bid_price():
    """Resting bid at $10, incoming ask at $8 → trades execute at $10 (maker price)."""
    s = fresh_state()
    # P0 posts bid for 5 of B at $10
    post_order(s, player_idx=0, side="bid", food_type="B", quantity=5, price_per_unit=10)
    # P1 posts ask for 5 of B at $8 → crosses, trades at $10
    _, trades = post_order(
        s, player_idx=1, side="ask", food_type="B", quantity=5, price_per_unit=8
    )
    assert len(trades) == 1
    t = trades[0]
    assert t.price_per_unit == 10
    assert t.quantity == 5
    assert t.buyer_idx == 0 and t.seller_idx == 1
    # Cash deltas
    assert s.players[0].cash == 1000 - 50
    assert s.players[1].cash == 1000 + 50
    # Inventory deltas
    assert s.players[0].inventory["B"] == 50 + 5
    assert s.players[1].inventory["B"] == 50 - 5


def test_resting_ask_takes_incoming_bid_at_ask_price():
    """Resting ask at $8, incoming bid at $10 → trades at $8 (maker price)."""
    s = fresh_state()
    post_order(s, player_idx=0, side="ask", food_type="C", quantity=5, price_per_unit=8)
    _, trades = post_order(
        s, player_idx=1, side="bid", food_type="C", quantity=5, price_per_unit=10
    )
    assert len(trades) == 1
    assert trades[0].price_per_unit == 8
    # Buyer paid 5*8=40 (not 5*10=50). Reserved 50, paid 40, refund 10 → cash 1000-40.
    assert s.players[1].cash == 1000 - 40


# ---------------------------------------------------------------------------
# Partial fills
# ---------------------------------------------------------------------------


def test_partial_fill_leaves_residual_on_book():
    """Bid for 5, ask for 2 → 2 trade, bid leaves 3 on the book."""
    s = fresh_state()
    bid_order, _ = post_order(
        s, player_idx=0, side="bid", food_type="A", quantity=5, price_per_unit=10
    )
    _, trades = post_order(
        s, player_idx=1, side="ask", food_type="A", quantity=2, price_per_unit=8
    )
    assert len(trades) == 1
    assert trades[0].quantity == 2
    assert bid_order.remaining_quantity == 3
    assert bid_order.status == "partially_filled"
    # Book should have a bid for 3 remaining
    book = s.order_books["A"]
    assert len(book.bids) == 1 and book.bids[0].remaining_quantity == 3
    assert len(book.asks) == 0


def test_one_incoming_fills_against_multiple_resting():
    """Three asks at different prices, incoming bid sweeps."""
    s = fresh_state()
    # Three players post asks
    post_order(s, player_idx=0, side="ask", food_type="D", quantity=2, price_per_unit=5)
    post_order(s, player_idx=2, side="ask", food_type="D", quantity=3, price_per_unit=6)
    post_order(s, player_idx=3, side="ask", food_type="D", quantity=5, price_per_unit=8)
    # P1 bids for 7 at $7 → should clear the $5 and $6 asks; the $8 ask stays.
    _, trades = post_order(
        s, player_idx=1, side="bid", food_type="D", quantity=7, price_per_unit=7
    )
    assert len(trades) == 2
    # Sweep should hit lowest price first
    assert trades[0].price_per_unit == 5 and trades[0].quantity == 2
    assert trades[1].price_per_unit == 6 and trades[1].quantity == 3
    # 2 remaining on the bid → goes onto the book
    book = s.order_books["D"]
    assert any(b.remaining_quantity == 2 for b in book.bids)
    assert len(book.asks) == 1 and book.asks[0].price_per_unit == 8


# ---------------------------------------------------------------------------
# Price-time priority
# ---------------------------------------------------------------------------


def test_price_priority_then_time_priority():
    s = fresh_state()
    # Two bids at $10 (P0 first, then P2). One bid at $11 (P3).
    o1, _ = post_order(s, player_idx=0, side="bid", food_type="A", quantity=1, price_per_unit=10)
    o2, _ = post_order(s, player_idx=2, side="bid", food_type="A", quantity=1, price_per_unit=10)
    o3, _ = post_order(s, player_idx=3, side="bid", food_type="A", quantity=1, price_per_unit=11)
    # Incoming small ask should hit the $11 bid first
    _, trades = post_order(s, player_idx=1, side="ask", food_type="A", quantity=1, price_per_unit=5)
    assert len(trades) == 1 and trades[0].buyer_idx == 3 and trades[0].price_per_unit == 11
    # Next ask hits the older $10 bid (P0)
    _, trades = post_order(s, player_idx=1, side="ask", food_type="A", quantity=1, price_per_unit=5)
    assert trades[0].buyer_idx == 0
    # Next ask hits the newer $10 bid (P2)
    _, trades = post_order(s, player_idx=1, side="ask", food_type="A", quantity=1, price_per_unit=5)
    assert trades[0].buyer_idx == 2


# ---------------------------------------------------------------------------
# Self-trade prevention
# ---------------------------------------------------------------------------


def test_self_trade_skipped():
    """A player's incoming ask must NOT hit their own resting bid; it should hit
    a less attractive non-self bid instead, or sit on the book."""
    s = fresh_state()
    # P0 has best bid at $20
    post_order(s, player_idx=0, side="bid", food_type="A", quantity=1, price_per_unit=20)
    # P1 has a worse bid at $5
    post_order(s, player_idx=1, side="bid", food_type="A", quantity=1, price_per_unit=5)
    # P0 now posts an ask at $4. It SHOULD skip its own $20 bid and hit P1 at $5.
    _, trades = post_order(s, player_idx=0, side="ask", food_type="A", quantity=1, price_per_unit=4)
    assert len(trades) == 1
    assert trades[0].buyer_idx == 1
    assert trades[0].price_per_unit == 5


# ---------------------------------------------------------------------------
# Reservations
# ---------------------------------------------------------------------------


def test_bid_reserves_cash():
    s = fresh_state()
    post_order(s, player_idx=0, side="bid", food_type="A", quantity=3, price_per_unit=7)
    assert s.players[0].reserved_cash == 21
    assert s.players[0].available_cash() == 1000 - 21


def test_ask_reserves_inventory():
    s = fresh_state()
    post_order(s, player_idx=0, side="ask", food_type="B", quantity=5, price_per_unit=10)
    assert s.players[0].reserved_inventory["B"] == 5
    assert s.players[0].available("B") == 45


def test_cancel_releases_reservation():
    s = fresh_state()
    o, _ = post_order(s, player_idx=0, side="bid", food_type="A", quantity=4, price_per_unit=5)
    assert s.players[0].reserved_cash == 20
    cancel_order(s, player_idx=0, order_id=o.id)
    assert s.players[0].reserved_cash == 0


def test_cancel_all_releases_everything():
    s = fresh_state()
    post_order(s, player_idx=0, side="bid", food_type="A", quantity=3, price_per_unit=2)
    post_order(s, player_idx=0, side="ask", food_type="C", quantity=2, price_per_unit=99)
    assert s.players[0].reserved_cash == 6
    assert s.players[0].reserved_inventory["C"] == 2
    cancel_all_for_player(s, player_idx=0)
    assert s.players[0].reserved_cash == 0
    assert s.players[0].reserved_inventory["C"] == 0


def test_partial_fill_refunds_unused_reserved_cash():
    """Bid 10@$10 (reserved $100). Fills 4 at $7 (taker price unused — maker price wins).
    Here we set up: ask resting at $7, incoming bid at $10 → trades at $7.
    Reserved $100, actual cost = 4*$10 reservation released for filled qty (only 4 actually
    fill at maker price $7 → cost $28). Remaining 6 still reserved at $10 → $60.
    Refund check: cash should be 1000 - 28 = 972, reserved should be 60.
    """
    s = fresh_state()
    # Resting ask: 4 of A at $7 (P1)
    post_order(s, player_idx=1, side="ask", food_type="A", quantity=4, price_per_unit=7)
    # Incoming bid: 10 of A at $10 (P0) → trades 4 at $7
    post_order(s, player_idx=0, side="bid", food_type="A", quantity=10, price_per_unit=10)
    assert s.players[0].cash == 1000 - 28
    assert s.players[0].reserved_cash == 60


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


def test_insufficient_cash_rejected():
    s = fresh_state()
    s.players[0].cash = 10
    with pytest.raises(OrderError) as ei:
        post_order(s, player_idx=0, side="bid", food_type="A", quantity=10, price_per_unit=5)
    assert ei.value.code == "insufficient_cash"


def test_insufficient_inventory_rejected():
    s = fresh_state()
    s.players[0].inventory["A"] = 3
    with pytest.raises(OrderError) as ei:
        post_order(s, player_idx=0, side="ask", food_type="A", quantity=5, price_per_unit=5)
    assert ei.value.code == "insufficient_inventory"


def test_dead_player_cannot_order():
    s = fresh_state()
    s.players[0].status = "dead"
    with pytest.raises(OrderError) as ei:
        post_order(s, player_idx=0, side="bid", food_type="A", quantity=1, price_per_unit=1)
    assert ei.value.code == "player_dead"


def test_cancel_oldest_helper():
    s = fresh_state()
    o1, _ = post_order(s, player_idx=0, side="bid", food_type="A", quantity=1, price_per_unit=2)
    o2, _ = post_order(s, player_idx=0, side="bid", food_type="A", quantity=1, price_per_unit=3)
    cancelled = cancel_oldest_for_player_side_food(
        s, player_idx=0, side="bid", food_type="A"
    )
    assert cancelled is not None and cancelled.id == o1.id
    # Calling again removes the next oldest (which is now the last remaining)
    cancelled = cancel_oldest_for_player_side_food(
        s, player_idx=0, side="bid", food_type="A"
    )
    assert cancelled is not None and cancelled.id == o2.id
    # No more orders → returns None
    assert (
        cancel_oldest_for_player_side_food(s, player_idx=0, side="bid", food_type="A")
        is None
    )
