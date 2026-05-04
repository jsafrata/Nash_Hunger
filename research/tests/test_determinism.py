"""Same seed must produce identical games."""
import hashlib
import json

from env.actions import ACTION_NOOP, NUM_ACTIONS
from env.env import FoodTradingEnv


def trace_hash(env: FoodTradingEnv, actions_per_step: list) -> str:
    """Run env to completion using fixed action schedule. Hash final result + trades."""
    env.reset()
    for actions in actions_per_step:
        if env.is_done():
            break
        env.step(actions)
    payload = {
        "winners": env.state.winner_idxs,
        "end_reason": env.state.end_reason,
        "trades": [
            {
                "buyer": t.buyer_idx,
                "seller": t.seller_idx,
                "food": t.food_type,
                "price": t.price_per_unit,
                "qty": t.quantity,
                "tick": t.elapsed_second,
            }
            for t in env.state.trades
        ],
        "final_cash": [p.cash for p in env.state.players],
        "final_inventory": [dict(p.inventory) for p in env.state.players],
    }
    s = json.dumps(payload, sort_keys=True)
    return hashlib.sha256(s.encode()).hexdigest()


def test_same_seed_with_random_actions_produces_same_outcome():
    """We use a fixed pseudo-random action schedule (not RandomAgent which would
    inject its own randomness) to verify the env is purely deterministic given
    a seed and action history."""
    import random

    rnd = random.Random(99)
    schedule = []
    for _t in range(180):
        per_step = {i: rnd.randrange(NUM_ACTIONS) for i in range(4)}
        schedule.append(per_step)

    env_a = FoodTradingEnv(seed=42)
    env_b = FoodTradingEnv(seed=42)
    h_a = trace_hash(env_a, schedule)
    h_b = trace_hash(env_b, schedule)
    assert h_a == h_b


def test_different_seed_produces_different_initial_deal():
    """With different seeds, initial inventories must differ."""
    e1 = FoodTradingEnv(seed=1)
    e2 = FoodTradingEnv(seed=2)
    e1.reset()
    e2.reset()
    inv1 = [dict(p.inventory) for p in e1.state.players]
    inv2 = [dict(p.inventory) for p in e2.state.players]
    assert inv1 != inv2


def test_all_noop_game_ends_early_with_at_most_one_survivor():
    """If everyone does nothing, every player is required to consume food they
    cannot produce. They will starve within ~25 ticks. The game ends either
    with no survivors or a single survivor (one player happens to be slightly
    better off in the random deal)."""
    for seed in range(10):
        env = FoodTradingEnv(seed=seed)
        env.reset()
        while not env.is_done():
            env.step({i: ACTION_NOOP for i in range(4)})
        res = env.get_result()
        assert res["end_reason"] in ("no_survivors", "single_survivor"), (
            seed,
            res["end_reason"],
        )
        # And it must end well before the time limit
        assert res["elapsed_seconds"] < 60, (seed, res["elapsed_seconds"])
