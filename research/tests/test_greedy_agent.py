from env.actions import PRICE_BUCKETS, QTY_BUCKETS, decode
from env.env import FoodTradingEnv
from env.market import post_order

from agents.greedy_agent import GreedyAgent


def _seeded_obs(seed: int = 42):
    env = FoodTradingEnv(seed=seed)
    obs = env.reset()
    return env, obs


def _seed_high_ask_market(env, player_idx: int, base_price: int, skip_foods: set[str]) -> None:
    for idx, player in enumerate(env.state.players):
        if idx == player_idx:
            continue
        food = player.produces
        if food in skip_foods:
            continue
        env.state.players[idx].inventory[food] = max(env.state.players[idx].inventory[food], 10)
        env.state.players[idx].reserved_inventory[food] = 0
        post_order(
            env.state,
            player_idx=idx,
            side="ask",
            food_type=food,
            quantity=1,
            price_per_unit=base_price,
        )


def test_normalized_values_raise_required_scarcity():
    agent = GreedyAgent()
    scarce = agent._normalized_food_values(
        inventory={"A": 20.0, "B": 2.0, "C": 20.0, "D": 20.0},
        produces="A",
        required_foods=["B", "C", "D"],
    )
    stocked = agent._normalized_food_values(
        inventory={"A": 20.0, "B": 12.0, "C": 20.0, "D": 20.0},
        produces="A",
        required_foods=["B", "C", "D"],
    )
    assert scarce["B"] > stocked["B"]


def test_normalized_value_of_produced_food_is_zero():
    agent = GreedyAgent()
    values = agent._normalized_food_values(
        inventory={"A": 8.0, "B": 12.0, "C": 12.0, "D": 12.0},
        produces="A",
        required_foods=["B", "C", "D"],
    )
    assert values["A"] == 0.0


def test_unnormalized_values_scale_with_market_anchor():
    agent = GreedyAgent()
    normalized = {"A": 0.5, "B": 1.5, "C": 1.0, "D": 1.0}
    base = agent._unnormalize_food_values(normalized, market_anchor=2.0)
    scaled = agent._unnormalize_food_values(normalized, market_anchor=20.0)
    assert scaled["B"] == base["B"] * 10.0
    assert scaled["A"] == base["A"] * 10.0


def test_market_anchor_is_side_specific():
    env, obs = _seeded_obs()
    player_idx = 0
    seen_foods = []
    bid_price = 3
    ask_price = 11
    for idx, player in enumerate(env.state.players):
        if idx == player_idx:
            continue
        food = player.produces
        if food in seen_foods:
            continue
        seen_foods.append(food)
        env.state.players[idx].inventory[food] = 20
        env.state.players[idx].reserved_inventory[food] = 0
        post_order(
            env.state,
            player_idx=idx,
            side="ask",
            food_type=food,
            quantity=1,
            price_per_unit=ask_price,
        )
        env.state.players[player_idx].cash = 100
        post_order(
            env.state,
            player_idx=player_idx,
            side="bid",
            food_type=food,
            quantity=1,
            price_per_unit=bid_price,
        )

    agent = GreedyAgent()
    now = env.observe(player_idx)
    normalized = agent._normalized_food_values(
        inventory={f: float(now["available_inventory"][f]) for f in ("A", "B", "C", "D")},
        produces=now["produces"],
        required_foods=now["required_foods"],
    )
    expected_buy = sum(
        float(now["order_books"][food]["asks"][0]["price"]) / normalized[food]
        for food in ("A", "B", "C", "D")
        if normalized[food] > 0.0 and now["order_books"][food]["asks"]
    ) / sum(
        1
        for food in ("A", "B", "C", "D")
        if normalized[food] > 0.0 and now["order_books"][food]["asks"]
    )
    expected_sell = sum(
        float(now["order_books"][food]["bids"][0]["price"]) / normalized[food]
        for food in ("A", "B", "C", "D")
        if normalized[food] > 0.0 and now["order_books"][food]["bids"]
    ) / sum(
        1
        for food in ("A", "B", "C", "D")
        if normalized[food] > 0.0 and now["order_books"][food]["bids"]
    )
    assert agent._market_anchor(now, normalized, "buy") == expected_buy
    assert agent._market_anchor(now, normalized, "sell") == expected_sell


def test_low_stock_required_food_outranks_less_scarce_food():
    env, obs = _seeded_obs()
    player_idx = 0
    own_food = obs[player_idx]["produces"]
    required = [food for food in ("A", "B", "C", "D") if food != own_food]
    urgent_food = required[0]
    calmer_food = required[1]

    env.state.players[player_idx].inventory = {
        own_food: 18,
        urgent_food: 1,
        calmer_food: 9,
        required[2]: 9,
    }
    env.state.players[player_idx].reserved_inventory = {food: 0 for food in ("A", "B", "C", "D")}
    env.state.players[player_idx].cash = 100
    env.state.players[player_idx].reserved_cash = 0
    seller_idx = next(p.idx for p in env.state.players if p.idx != player_idx and p.produces == urgent_food)
    env.state.players[seller_idx].inventory[urgent_food] = 10
    env.state.players[seller_idx].reserved_inventory[urgent_food] = 0
    post_order(
        env.state,
        player_idx=seller_idx,
        side="ask",
        food_type=urgent_food,
        quantity=2,
        price_per_unit=2,
    )
    calmer_seller_idx = next(
        p.idx for p in env.state.players if p.idx not in (player_idx, seller_idx) and p.produces == calmer_food
    )
    env.state.players[calmer_seller_idx].inventory[calmer_food] = 10
    env.state.players[calmer_seller_idx].reserved_inventory[calmer_food] = 0
    post_order(
        env.state,
        player_idx=calmer_seller_idx,
        side="ask",
        food_type=calmer_food,
        quantity=2,
        price_per_unit=4,
    )
    _seed_high_ask_market(env, player_idx, base_price=10, skip_foods={urgent_food, calmer_food})

    agent = GreedyAgent()
    action = agent.act(env.observe(player_idx), env.legal_actions(player_idx))
    decoded = decode(action)
    assert decoded.side == "bid"
    assert decoded.food_type == urgent_food


def test_action_is_always_legal_under_tight_cash():
    env, obs = _seeded_obs()
    player_idx = 0
    env.state.players[player_idx].cash = 2
    env.state.players[player_idx].reserved_cash = 0
    for food in ("A", "B", "C", "D"):
        env.state.players[player_idx].inventory[food] = 1 if food != obs[player_idx]["produces"] else 20
        env.state.players[player_idx].reserved_inventory[food] = 0

    agent = GreedyAgent()
    legal = env.legal_actions(player_idx)
    action = agent.act(env.observe(player_idx), legal)
    assert legal[action]
    decoded = decode(action)
    if decoded.side == "bid":
        assert decoded.quantity * decoded.price_per_unit <= env.state.players[player_idx].cash


def test_high_estimated_willingness_raises_sell_floor():
    env, obs = _seeded_obs()
    player_idx = 0
    own_food = obs[player_idx]["produces"]
    required = [food for food in ("A", "B", "C", "D") if food != own_food]

    env.state.players[player_idx].inventory = {
        own_food: 18,
        required[0]: 12,
        required[1]: 12,
        required[2]: 12,
    }
    env.state.players[player_idx].reserved_inventory = {food: 0 for food in ("A", "B", "C", "D")}
    env.state.players[player_idx].cash = 100
    env.state.players[player_idx].reserved_cash = 0

    agent = GreedyAgent()
    rich_obs = env.observe(player_idx)
    agent._ensure_initialized(rich_obs)
    normalized = agent._normalized_food_values(
        inventory={f: float(rich_obs["available_inventory"][f]) for f in ("A", "B", "C", "D")},
        produces=rich_obs["produces"],
        required_foods=rich_obs["required_foods"],
    )
    market_anchor = agent._market_anchor(rich_obs, normalized, "sell")
    first_opp = next(idx for idx in agent._estimates.keys())
    agent._estimates[first_opp].cash = 10.0
    agent._estimates[first_opp].produced_inventory = 0.0
    low = agent._best_sell_candidate(rich_obs, env.legal_actions(player_idx), market_anchor)

    agent._estimates[first_opp].cash = 100.0
    agent._estimates[first_opp].produced_inventory = 0.0
    high = agent._best_sell_candidate(rich_obs, env.legal_actions(player_idx), market_anchor)

    assert low is not None
    assert high is not None
    low_decoded = decode(low[1])
    high_decoded = decode(high[1])
    assert high_decoded.side == "ask"
    assert high_decoded.food_type == own_food
    assert high_decoded.price_per_unit >= low_decoded.price_per_unit


def test_market_price_shift_preserves_buy_direction_and_scales_bid():
    env, obs = _seeded_obs()
    player_idx = 0
    own_food = obs[player_idx]["produces"]
    required = [food for food in ("A", "B", "C", "D") if food != own_food]
    urgent_food = required[0]

    env.state.players[player_idx].inventory = {
        own_food: 16,
        urgent_food: 1,
        required[1]: 10,
        required[2]: 10,
    }
    env.state.players[player_idx].reserved_inventory = {food: 0 for food in ("A", "B", "C", "D")}
    env.state.players[player_idx].cash = 100
    env.state.players[player_idx].reserved_cash = 0

    for food in ("A", "B", "C", "D"):
        env.state.order_books[food].bids.clear()
        env.state.order_books[food].asks.clear()
    env.state.trades.clear()
    seller_idx = next(p.idx for p in env.state.players if p.idx != player_idx and p.produces == urgent_food)
    env.state.players[seller_idx].inventory[urgent_food] = 10
    env.state.players[seller_idx].reserved_inventory[urgent_food] = 0
    post_order(
        env.state,
        player_idx=seller_idx,
        side="ask",
        food_type=urgent_food,
        quantity=2,
        price_per_unit=1,
    )
    _seed_high_ask_market(env, player_idx, base_price=10, skip_foods={urgent_food})

    agent = GreedyAgent()

    low_obs = env.observe(player_idx)
    low_action = agent.act(low_obs, env.legal_actions(player_idx))
    low_decoded = decode(low_action)

    for food in ("A", "B", "C", "D"):
        env.state.order_books[food].bids.clear()
        env.state.order_books[food].asks.clear()
    post_order(
        env.state,
        player_idx=seller_idx,
        side="ask",
        food_type=urgent_food,
        quantity=2,
        price_per_unit=10,
    )
    _seed_high_ask_market(env, player_idx, base_price=100, skip_foods={urgent_food})

    boosted_obs = env.observe(player_idx)
    agent.reset()
    high_action = agent.act(boosted_obs, env.legal_actions(player_idx))
    high_decoded = decode(high_action)

    assert low_decoded.side == "bid"
    assert high_decoded.side == "bid"
    assert low_decoded.food_type == urgent_food
    assert high_decoded.food_type == urgent_food
    assert high_decoded.price_per_unit >= low_decoded.price_per_unit
