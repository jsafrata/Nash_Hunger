from env.config import DEFAULT_CONFIG
from env.rng import make_rng
from env.setup import initial_state
from env.tick import determine_winners, end_game


def fresh():
    rng = make_rng(0)
    return initial_state(DEFAULT_CONFIG, rng, ["P0", "P1", "P2", "P3"])


def test_single_survivor_wins():
    s = fresh()
    for i in [0, 1, 2]:
        s.players[i].status = "dead"
    s.players[3].cash = 5
    assert determine_winners(s) == [3]


def test_cash_tiebreak_among_survivors():
    s = fresh()
    for p in s.players:
        p.status = "alive"
    s.players[0].cash = 100
    s.players[1].cash = 200
    s.players[2].cash = 150
    s.players[3].cash = 200
    # Players 1 and 3 tied — but we need a food tiebreak
    s.players[1].inventory = {"A": 0, "B": 0, "C": 0, "D": 0}
    s.players[3].inventory = {"A": 5, "B": 5, "C": 5, "D": 5}
    assert determine_winners(s) == [3]


def test_cash_winner_unique():
    s = fresh()
    s.players[0].cash = 1
    s.players[1].cash = 2
    s.players[2].cash = 3
    s.players[3].cash = 100
    assert determine_winners(s) == [3]


def test_no_survivors_no_winner():
    s = fresh()
    for p in s.players:
        p.status = "dead"
    assert determine_winners(s) == []


def test_full_tie_returns_all_tied():
    s = fresh()
    for p in s.players:
        p.cash = 50
        p.inventory = {"A": 1, "B": 1, "C": 1, "D": 1}
    winners = determine_winners(s)
    assert set(winners) == {0, 1, 2, 3}


def test_end_game_sets_phase_and_winners():
    s = fresh()
    s.players[0].cash = 999
    end_game(s, "time_limit")
    assert s.phase == "ended"
    assert s.end_reason == "time_limit"
    assert s.winner_idxs == [0]
