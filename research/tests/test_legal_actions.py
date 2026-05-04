import numpy as np

from env.actions import (
    ACTION_CANCEL_ALL,
    ACTION_CANCEL_BASE,
    ACTION_NOOP,
    NUM_ACTIONS,
    NUM_FOODS,
    PRICE_BUCKETS,
    QTY_BUCKETS,
    apply_action,
    decode,
    encode_trade,
    legal_action_mask,
)
from env.config import DEFAULT_CONFIG
from env.env import FoodTradingEnv


def test_action_space_size():
    assert NUM_ACTIONS == 410


def test_decode_trade_roundtrip():
    a = encode_trade("bid", "C", 2, 5)  # qty bucket idx 2 → qty=4 ; price bucket idx 5 → price=6
    d = decode(a)
    assert d.side == "bid"
    assert d.food_type == "C"
    assert d.quantity == QTY_BUCKETS[2]
    assert d.price_per_unit == PRICE_BUCKETS[5]


def test_noop_always_legal_for_alive_player():
    env = FoodTradingEnv(seed=42)
    env.reset()
    for i in range(4):
        m = env.legal_actions(i)
        assert m[ACTION_NOOP] == True


def test_dead_player_only_noop_legal():
    env = FoodTradingEnv(seed=1)
    env.reset()
    env.state.players[0].status = "dead"
    m = env.legal_actions(0)
    assert m[ACTION_NOOP] == True
    # everything else False
    m2 = m.copy()
    m2[ACTION_NOOP] = False
    assert not m2.any()


def test_unaffordable_bid_excluded_from_mask():
    env = FoodTradingEnv(seed=1)
    env.reset()
    env.state.players[0].cash = 5
    env.state.players[0].reserved_cash = 0
    m = env.legal_actions(0)
    # bid at price 10, qty 16 → cost 160, way more than 5 → should be False
    a = encode_trade("bid", "A", QTY_BUCKETS.index(16), PRICE_BUCKETS.index(10))
    assert m[a] == False
    # bid at price 1, qty 1 → cost 1, ≤ 5 → True
    a = encode_trade("bid", "A", QTY_BUCKETS.index(1), PRICE_BUCKETS.index(1))
    assert m[a] == True


def test_oversized_ask_excluded_from_mask():
    env = FoodTradingEnv(seed=1)
    env.reset()
    p = env.state.players[0]
    p.inventory = {"A": 3, "B": 0, "C": 0, "D": 0}
    p.reserved_inventory = {"A": 0, "B": 0, "C": 0, "D": 0}
    m = env.legal_actions(0)
    # ask 16 of A → too many
    a = encode_trade("ask", "A", QTY_BUCKETS.index(16), PRICE_BUCKETS.index(5))
    assert m[a] == False
    # ask 2 of A → fits
    a = encode_trade("ask", "A", QTY_BUCKETS.index(2), PRICE_BUCKETS.index(5))
    assert m[a] == True
    # ask 1 of B (player has 0) → not legal
    a = encode_trade("ask", "B", QTY_BUCKETS.index(1), PRICE_BUCKETS.index(5))
    assert m[a] == False


def test_cancel_action_excluded_when_no_open_order():
    env = FoodTradingEnv(seed=1)
    env.reset()
    m = env.legal_actions(0)
    # No orders open → all 8 cancel actions illegal, cancel-all illegal
    for off in range(8):
        assert m[ACTION_CANCEL_BASE + off] == False
    assert m[ACTION_CANCEL_ALL] == False


def test_cancel_action_legal_after_posting():
    env = FoodTradingEnv(seed=1)
    env.reset()
    env.state.players[0].cash = 1000
    apply_action(env.state, 0, encode_trade("bid", "A", QTY_BUCKETS.index(1), PRICE_BUCKETS.index(1)))
    m = env.legal_actions(0)
    # cancel bid for A → legal
    cancel_idx = ACTION_CANCEL_BASE + 0 * NUM_FOODS + 0  # side=bid, food=A
    assert m[cancel_idx] == True
    assert m[ACTION_CANCEL_ALL] == True


def test_apply_illegal_action_returns_failure_not_raises():
    env = FoodTradingEnv(seed=1)
    env.reset()
    env.state.players[0].cash = 0
    env.state.players[0].reserved_cash = 0
    res = apply_action(
        env.state, 0, encode_trade("bid", "A", QTY_BUCKETS.index(16), PRICE_BUCKETS.index(10))
    )
    assert res["applied"] == False
    assert res["code"] == "insufficient_cash"


def test_step_after_done_is_safe():
    env = FoodTradingEnv(seed=0, config=DEFAULT_CONFIG)
    env.reset()
    # Force end
    env.state.phase = "ended"
    obs, rew, done, info = env.step({i: ACTION_NOOP for i in range(4)})
    assert done == True
