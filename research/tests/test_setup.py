from collections import Counter

from env.config import DEFAULT_CONFIG, FOOD_TYPES
from env.rng import make_rng
from env.setup import (
    assign_producers,
    create_initial_deck,
    deal_initial_food,
    initial_state,
)
from env.types import Player


def test_deck_has_400_units_100_each():
    deck = create_initial_deck(DEFAULT_CONFIG)
    assert len(deck) == 400
    counts = Counter(deck)
    for f in FOOD_TYPES:
        assert counts[f] == 100


def test_each_player_gets_100_units():
    rng = make_rng(0)
    state = initial_state(
        DEFAULT_CONFIG, rng, ["A0", "A1", "A2", "A3"]
    )
    for p in state.players:
        assert sum(p.inventory.values()) == 100


def test_global_food_distribution_is_100_each():
    rng = make_rng(7)
    state = initial_state(
        DEFAULT_CONFIG, rng, ["A0", "A1", "A2", "A3"]
    )
    totals = {f: 0 for f in FOOD_TYPES}
    for p in state.players:
        for f in FOOD_TYPES:
            totals[f] += p.inventory[f]
    for f in FOOD_TYPES:
        assert totals[f] == 100


def test_each_producer_unique():
    rng = make_rng(123)
    state = initial_state(DEFAULT_CONFIG, rng, ["A", "B", "C", "D"])
    producers = {p.produces for p in state.players}
    assert producers == set(FOOD_TYPES)


def test_starting_cash():
    rng = make_rng(0)
    state = initial_state(DEFAULT_CONFIG, rng, ["x"] * 4)
    for p in state.players:
        assert p.cash == 100
        assert p.reserved_cash == 0


def test_assign_producers_requires_full_table():
    import pytest

    rng = make_rng(0)
    players = [Player(idx=i, name=f"p{i}") for i in range(3)]
    with pytest.raises(ValueError):
        assign_producers(rng, DEFAULT_CONFIG, players)


def test_deal_initial_food_uses_distinct_units():
    """Deal must consume disjoint slices of the deck."""
    rng = make_rng(42)
    deck = create_initial_deck(DEFAULT_CONFIG)
    # Don't shuffle — easier to verify
    players = [Player(idx=i, name=f"p{i}") for i in range(4)]
    deal_initial_food(DEFAULT_CONFIG, players, deck)
    # First 100 of deck = 100 As → goes to player 0
    assert players[0].inventory["A"] == 100
    # Next 100 of deck = 100 Bs → goes to player 1
    assert players[1].inventory["B"] == 100
