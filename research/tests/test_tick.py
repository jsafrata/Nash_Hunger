from env.config import DEFAULT_CONFIG
from env.rng import make_rng
from env.setup import initial_state
from env.tick import consume_and_kill, kill_player, produce_food, step_tick


def fresh():
    rng = make_rng(0)
    s = initial_state(DEFAULT_CONFIG, rng, ["P0", "P1", "P2", "P3"])
    return s


def test_production_adds_2_to_own_food_for_alive_only():
    s = fresh()
    before = [p.inventory[p.produces] for p in s.players]
    produce_food(s)
    after = [p.inventory[p.produces] for p in s.players]
    for b, a in zip(before, after):
        assert a == b + 2

    # Now kill one and verify it doesn't produce
    s.players[0].status = "dead"
    before = s.players[0].inventory[s.players[0].produces]
    produce_food(s)
    assert s.players[0].inventory[s.players[0].produces] == before


def test_consumption_removes_one_of_each_required_food_only():
    s = fresh()
    # Force inventories so we know who consumes what
    for p in s.players:
        p.inventory = {"A": 5, "B": 5, "C": 5, "D": 5}
        p.reserved_inventory = {"A": 0, "B": 0, "C": 0, "D": 0}
    deaths = consume_and_kill(s)
    assert deaths == []
    for p in s.players:
        for f in ("A", "B", "C", "D"):
            if f == p.produces:
                assert p.inventory[f] == 5  # producer doesn't consume
            else:
                assert p.inventory[f] == 4  # 1 consumed


def test_player_dies_when_missing_required_food():
    s = fresh()
    # P0 has no B, C, D — must die at next consumption tick (regardless of producer)
    s.players[0].inventory = {"A": 100, "B": 0, "C": 0, "D": 0}
    s.players[0].reserved_inventory = {"A": 0, "B": 0, "C": 0, "D": 0}
    deaths = consume_and_kill(s)
    found = [d for d in deaths if d["player_idx"] == 0]
    assert len(found) == 1
    # Missing foods exclude the producer's own food
    expected_missing = {f for f in ("A", "B", "C", "D") if f != s.players[0].produces}
    assert set(found[0]["missing_foods"]) == expected_missing


def test_reserved_inventory_excluded_from_consumption_check():
    """Even if total inventory has enough, if reserved makes available < 1, dies."""
    s = fresh()
    # Pick a non-producer food for player 0
    needed_food = next(f for f in ("A", "B", "C", "D") if f != s.players[0].produces)
    s.players[0].inventory = {f: 100 for f in ("A", "B", "C", "D")}
    # Reserve all of `needed_food` → available = 0
    s.players[0].reserved_inventory = {f: 0 for f in ("A", "B", "C", "D")}
    s.players[0].reserved_inventory[needed_food] = 100
    deaths = consume_and_kill(s)
    found = [d for d in deaths if d["player_idx"] == 0]
    assert len(found) == 1


def test_kill_player_zeros_reservations_and_cancels_orders():
    from env.market import post_order

    s = fresh()
    # Stack the deck for P0
    s.players[0].cash = 1000
    s.players[0].inventory = {"A": 50, "B": 50, "C": 50, "D": 50}
    post_order(s, player_idx=0, side="bid", food_type="A", quantity=2, price_per_unit=3)
    post_order(s, player_idx=0, side="ask", food_type="C", quantity=4, price_per_unit=99)
    assert s.players[0].reserved_cash > 0
    assert s.players[0].reserved_inventory["C"] > 0

    kill_player(s, s.players[0], ["B"])
    assert s.players[0].status == "dead"
    assert s.players[0].reserved_cash == 0
    assert all(v == 0 for v in s.players[0].reserved_inventory.values())
    # Books should have no orders from P0
    for f in ("A", "B", "C", "D"):
        for o in s.order_books[f].bids + s.order_books[f].asks:
            assert o.player_idx != 0


def test_tick_clock_advances():
    s = fresh()
    assert s.elapsed_seconds == 0
    step_tick(s)
    assert s.elapsed_seconds == 1


def test_tick_ends_at_max_seconds():
    from env.config import GameConfig

    config = GameConfig(game_duration_seconds=2)
    rng = make_rng(0)
    s = initial_state(config, rng, ["P0", "P1", "P2", "P3"])
    # Pad inventories so nobody dies of starvation in 2 ticks
    for p in s.players:
        p.inventory = {"A": 100, "B": 100, "C": 100, "D": 100}
    r = step_tick(s)
    assert not r.ended
    r = step_tick(s)
    assert r.ended
    assert r.end_reason == "time_limit"
    assert s.phase == "ended"


def test_tick_ends_when_only_one_survivor():
    s = fresh()
    # Force 3 players to die: clear all their non-producer foods
    for idx in [0, 1, 2]:
        p = s.players[idx]
        for f in ("A", "B", "C", "D"):
            if f != p.produces:
                p.inventory[f] = 0
    # Make sure player 3 stays alive
    s.players[3].inventory = {"A": 100, "B": 100, "C": 100, "D": 100}
    r = step_tick(s)
    assert r.ended
    assert r.end_reason == "single_survivor"
    assert s.alive_count() == 1
    assert s.players[3].status == "alive"
